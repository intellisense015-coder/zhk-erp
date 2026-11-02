-- Atomic purchase edit operation.
-- Only quantity and unit cost are editable. Supplier identity, payments,
-- funding, invoice numbering, and the recorded date remain immutable so the
-- purchase and supplier-payment ledgers cannot be rewritten from the browser.

create or replace function public.update_purchase(
  target_workspace_id uuid,
  target_purchase_id uuid,
  purchase_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_row public.transactions%rowtype;
  purchase_item_row public.purchase_items%rowtype;
  product_row public.products%rowtype;
  supplier_row public.suppliers%rowtype;
  requested_quantity integer := coalesce(nullif(purchase_payload->>'quantity', '')::integer, 0);
  requested_unit_cost numeric := coalesce(nullif(purchase_payload->>'unit_cost', '')::numeric, 0);
  previous_quantity integer;
  previous_unit_cost numeric;
  previous_total numeric;
  previous_paid numeric;
  next_total numeric;
  quantity_delta integer;
  purchase_item_count integer;
  stock_movement_count integer;
  stock_movement_quantity integer;
begin
  requested_unit_cost := round(requested_unit_cost, 2);

  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to edit purchases';
  end if;

  if requested_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if requested_unit_cost <= 0 or requested_unit_cost > 999999999999.99 then
    raise exception 'Unit cost must be greater than zero and within the supported limit';
  end if;
  if requested_quantity::numeric * requested_unit_cost > 999999999999.99 then
    raise exception 'The purchase total is beyond the supported limit';
  end if;

  select * into purchase_row
  from public.transactions
  where id = target_purchase_id
    and workspace_id = target_workspace_id
    and transaction_type = 'purchase'
  for update;

  if not found then
    raise exception 'Purchase record not found';
  end if;

  select count(*) into purchase_item_count
  from public.purchase_items
  where transaction_id = purchase_row.id
    and workspace_id = target_workspace_id;

  if purchase_item_count <> 1 then
    raise exception 'This purchase does not have exactly one editable item record';
  end if;

  select * into purchase_item_row
  from public.purchase_items
  where transaction_id = purchase_row.id
    and workspace_id = target_workspace_id
  order by line_number
  limit 1
  for update;

  if not found or purchase_row.product_id is null or purchase_item_row.product_id <> purchase_row.product_id then
    raise exception 'This purchase does not have a consistent editable item record';
  end if;

  previous_quantity := purchase_item_row.quantity;
  previous_unit_cost := purchase_item_row.unit_cost;
  previous_total := previous_quantity * previous_unit_cost;
  previous_paid := coalesce(purchase_row.paid_amount, 0);
  next_total := requested_quantity * requested_unit_cost;

  if previous_quantity <= 0 or previous_unit_cost <= 0
     or purchase_row.quantity <> previous_quantity
     or purchase_row.amount <> previous_total then
    raise exception 'This purchase record is inconsistent and cannot be edited safely';
  end if;
  if previous_paid < 0 or previous_paid > next_total then
    raise exception 'Purchase total cannot be lower than the amount already paid';
  end if;

  select * into product_row
  from public.products
  where id = purchase_item_row.product_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'The product attached to this purchase no longer exists';
  end if;

  quantity_delta := requested_quantity - previous_quantity;
  if quantity_delta > 0 and product_row.stock_quantity > 2147483647 - quantity_delta then
    raise exception 'The resulting stock quantity is too large';
  end if;
  if quantity_delta > 0 and product_row.received_quantity > 2147483647 - quantity_delta then
    raise exception 'The resulting received quantity is too large';
  end if;
  if product_row.stock_quantity + quantity_delta < 0 then
    raise exception 'The edited purchase would make stock negative';
  end if;
  if product_row.received_quantity + quantity_delta < 0 then
    raise exception 'The edited purchase would make received stock negative';
  end if;

  if purchase_row.supplier_id is not null then
    select * into supplier_row
    from public.suppliers
    where id = purchase_row.supplier_id
      and workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'The supplier attached to this purchase no longer exists';
    end if;
  end if;

  select count(*), coalesce(sum(movement.quantity_delta), 0)
    into stock_movement_count, stock_movement_quantity
  from public.stock_movements movement
  where movement.workspace_id = target_workspace_id
    and movement.transaction_id = purchase_row.id
    and movement.product_id = product_row.id
    and movement.movement_type = 'purchase';

  if stock_movement_count <> 1 or stock_movement_quantity <> previous_quantity then
    raise exception 'This purchase does not have a consistent stock movement record';
  end if;

  update public.transactions
  set quantity = requested_quantity,
      amount = next_total,
      unit_cost = requested_unit_cost,
      outstanding_amount = next_total - previous_paid
  where id = purchase_row.id
    and workspace_id = target_workspace_id;

  update public.purchase_items
  set quantity = requested_quantity,
      unit_cost = requested_unit_cost,
      amount = next_total
  where transaction_id = purchase_row.id
    and workspace_id = target_workspace_id;

  update public.stock_movements
  set quantity_delta = requested_quantity,
      unit_cost = requested_unit_cost
  where workspace_id = target_workspace_id
    and transaction_id = purchase_row.id
    and product_id = product_row.id
    and movement_type = 'purchase';

  update public.products
  set stock_quantity = product_row.stock_quantity + quantity_delta,
      received_quantity = product_row.received_quantity + quantity_delta,
      cost_price = coalesce((
        select movement.unit_cost
        from public.stock_movements movement
        where movement.workspace_id = target_workspace_id
          and movement.product_id = product_row.id
          and movement.quantity_delta > 0
          and movement.movement_type in ('purchase', 'trade-in', 'adjustment')
        order by movement.created_at desc, movement.id desc
        limit 1
      ), product_row.cost_price)
  where id = product_row.id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'purchase',
    purchase_row.id,
    jsonb_build_object(
      'previous_quantity', previous_quantity,
      'new_quantity', requested_quantity,
      'previous_unit_cost', previous_unit_cost,
      'new_unit_cost', requested_unit_cost,
      'previous_total', previous_total,
      'new_total', next_total,
      'paid_amount', previous_paid
    )
  );

  return purchase_row.id;
end;
$$;

revoke all on function public.update_purchase(uuid, uuid, jsonb) from public;
revoke all on function public.update_purchase(uuid, uuid, jsonb) from anon;
revoke all on function public.update_purchase(uuid, uuid, jsonb) from authenticated;
grant execute on function public.update_purchase(uuid, uuid, jsonb) to authenticated;
