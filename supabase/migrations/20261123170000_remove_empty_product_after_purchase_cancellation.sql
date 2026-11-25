-- Cancel a purchase atomically and remove a product only when that purchase was
-- the product's complete, unused history. Products with sales or other stock
-- history remain as audit records and are hidden from the sale catalog at zero
-- stock instead of being hard-deleted.

create or replace function public.cancel_purchase(
  target_workspace_id uuid,
  target_purchase_id uuid
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
  purchased_for_supplier numeric;
  non_linked_paid numeric;
  purchase_quantity integer;
  movement_quantity integer;
  movement_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to cancel purchases'; end if;

  select * into purchase_row
  from public.transactions
  where id = target_purchase_id
    and workspace_id = target_workspace_id
    and transaction_type = 'purchase'
    and source = 'supplier'
  for update;
  if not found then raise exception 'Supplier purchase record not found'; end if;

  select count(*), coalesce(sum(quantity_delta), 0)
    into movement_count, movement_quantity
  from public.stock_movements
  where workspace_id = target_workspace_id
    and transaction_id = target_purchase_id
    and movement_type = 'purchase';

  select * into purchase_item_row
  from public.purchase_items
  where workspace_id = target_workspace_id
    and transaction_id = target_purchase_id
  order by line_number
  limit 1
  for update;
  if not found or purchase_item_row.product_id is distinct from purchase_row.product_id then raise exception 'This purchase does not have a consistent item record'; end if;

  purchase_quantity := purchase_item_row.quantity;
  if movement_count <> 1 or movement_quantity <> purchase_quantity then raise exception 'This purchase does not have a consistent stock movement record'; end if;

  select * into product_row
  from public.products
  where id = purchase_item_row.product_id
    and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'The product attached to this purchase no longer exists'; end if;
  if product_row.stock_quantity < purchase_quantity or product_row.received_quantity < purchase_quantity then raise exception 'This purchase cannot be cancelled because the stock has already been consumed'; end if;

  if purchase_row.supplier_id is not null then
    select * into supplier_row
    from public.suppliers
    where id = purchase_row.supplier_id
      and workspace_id = target_workspace_id
    for update;
    if not found then raise exception 'The supplier attached to this purchase no longer exists'; end if;

    select coalesce(sum(amount), 0) into purchased_for_supplier
    from public.transactions
    where workspace_id = target_workspace_id
      and transaction_type = 'purchase'
      and supplier_id = purchase_row.supplier_id
      and id <> target_purchase_id;
    select coalesce(sum(amount), 0) into non_linked_paid
    from public.supplier_payments
    where workspace_id = target_workspace_id
      and supplier_id = purchase_row.supplier_id
      and purchase_transaction_id is null;
    if non_linked_paid > purchased_for_supplier + supplier_row.opening_balance then raise exception 'This purchase cannot be cancelled because supplier payments would exceed the remaining supplier balance'; end if;
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'cancel', 'purchase', target_purchase_id,
    jsonb_build_object('quantity', purchase_quantity, 'amount', purchase_row.amount, 'product_id', purchase_item_row.product_id));

  delete from public.supplier_payments where workspace_id = target_workspace_id and purchase_transaction_id = target_purchase_id;
  delete from public.stock_movements where workspace_id = target_workspace_id and transaction_id = target_purchase_id;

  update public.products
  set stock_quantity = stock_quantity - purchase_quantity,
      received_quantity = received_quantity - purchase_quantity,
      cost_price = coalesce((
        select movement.unit_cost
        from public.stock_movements movement
        where movement.workspace_id = target_workspace_id
          and movement.product_id = product_row.id
          and movement.quantity_delta > 0
          and movement.movement_type in ('purchase', 'trade-in', 'adjustment')
        order by movement.created_at desc, movement.id desc
        limit 1
      ), cost_price)
  where id = product_row.id and workspace_id = target_workspace_id;

  delete from public.transactions where id = target_purchase_id and workspace_id = target_workspace_id;

  if product_row.stock_quantity = purchase_quantity
     and product_row.received_quantity = purchase_quantity
     and not exists (select 1 from public.sale_items where workspace_id = target_workspace_id and product_id = product_row.id)
     and not exists (select 1 from public.purchase_items where workspace_id = target_workspace_id and product_id = product_row.id)
     and not exists (select 1 from public.stock_movements where workspace_id = target_workspace_id and product_id = product_row.id)
     and not exists (select 1 from public.transactions where workspace_id = target_workspace_id and product_id = product_row.id)
  then
    delete from public.products where id = product_row.id and workspace_id = target_workspace_id;
  end if;

  return target_purchase_id;
end;
$$;

revoke all on function public.cancel_purchase(uuid, uuid) from public, anon;
grant execute on function public.cancel_purchase(uuid, uuid) to authenticated;
