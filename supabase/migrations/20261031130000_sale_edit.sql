-- Atomic sale edit operation.
-- The browser submits editable intent only. PostgreSQL recalculates totals,
-- profit, stock, and sale snapshots, then records the change in the audit log.

create or replace function public.update_sale(
  target_workspace_id uuid,
  target_sale_id uuid,
  sale_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.transactions%rowtype;
  customer_row public.customers%rowtype;
  sale_item_row public.sale_items%rowtype;
  product_row public.products%rowtype;
  line jsonb;
  resolved_line jsonb;
  resolved_items jsonb := '[]'::jsonb;
  old_product_ids uuid[] := array[]::uuid[];
  requested_product_ids uuid[] := array[]::uuid[];
  requested_customer_name text := nullif(trim(coalesce(sale_payload->>'customer_name', '')), '');
  old_item_count integer;
  requested_item_count integer;
  old_quantity integer := 0;
  old_total numeric := 0;
  old_profit numeric := 0;
  total_quantity integer := 0;
  total_amount numeric := 0;
  total_profit numeric := 0;
  line_number integer := 0;
  line_product_id uuid;
  line_quantity integer;
  line_unit_price numeric;
  line_discount numeric;
  line_unit_cost numeric;
  line_amount numeric;
  line_profit numeric;
  first_item_name text;
  old_movement_count integer;
  item_movement_count integer;
  item_movement_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to edit sales';
  end if;

  if requested_customer_name is null or length(requested_customer_name) > 200 then
    raise exception 'Customer name is required and must be 200 characters or less';
  end if;
  if coalesce(jsonb_typeof(sale_payload->'items'), '') <> 'array' then
    raise exception 'A sale must contain at least one item';
  end if;

  requested_item_count := coalesce(jsonb_array_length(sale_payload->'items'), 0);
  if requested_item_count < 1 or requested_item_count > 50 then
    raise exception 'A sale can contain between 1 and 50 items';
  end if;

  select * into sale_row
  from public.transactions
  where id = target_sale_id
    and workspace_id = target_workspace_id
    and transaction_type = 'sale'
  for update;

  if not found then
    raise exception 'Sale record not found';
  end if;
  if sale_row.exchange_id is not null
     or sale_row.source = 'exchange'
     or sale_row.trade_in_credit is not null
     or sale_row.amount_due is not null then
    raise exception 'Exchange-linked sales must be edited through the exchange operation';
  end if;
  if sale_row.customer_id is null then
    raise exception 'This sale does not have a consistent customer record';
  end if;

  select * into customer_row
  from public.customers
  where id = sale_row.customer_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'The customer attached to this sale no longer exists';
  end if;

  select count(*) into old_item_count
  from public.sale_items
  where transaction_id = sale_row.id
    and workspace_id = target_workspace_id;

  if old_item_count < 1 or old_item_count > 50 then
    raise exception 'This sale does not have a consistent editable item record';
  end if;

  -- Lock the existing sale items and validate their financial snapshots before
  -- any stock is restored. Duplicate products would make a sale ambiguous.
  for sale_item_row in
    select *
    from public.sale_items
    where transaction_id = sale_row.id
      and workspace_id = target_workspace_id
    order by line_number
    for update
  loop
    if sale_item_row.product_id = any(old_product_ids) then
      raise exception 'This sale contains duplicate product lines and cannot be edited safely';
    end if;
    old_product_ids := array_append(old_product_ids, sale_item_row.product_id);

    if sale_item_row.quantity <= 0
       or sale_item_row.unit_selling_price <= 0
       or sale_item_row.unit_cost < 0
       or sale_item_row.discount < 0
       or sale_item_row.discount > sale_item_row.quantity * sale_item_row.unit_selling_price
       or sale_item_row.amount <> sale_item_row.quantity * sale_item_row.unit_selling_price - sale_item_row.discount
       or sale_item_row.profit <> sale_item_row.amount - sale_item_row.quantity * sale_item_row.unit_cost then
      raise exception 'This sale contains an inconsistent financial snapshot';
    end if;

    if sale_item_row.quantity > 2147483647 - old_quantity then
      raise exception 'The existing sale quantity is too large';
    end if;
    old_quantity := old_quantity + sale_item_row.quantity;
    old_total := old_total + sale_item_row.amount;
    old_profit := old_profit + sale_item_row.profit;
  end loop;

  if sale_row.quantity <> old_quantity
     or sale_row.amount <> old_total
     or sale_row.profit is null
     or sale_row.profit <> old_profit then
    raise exception 'This sale total is inconsistent with its item records';
  end if;

  select count(*) into old_movement_count
  from public.stock_movements
  where workspace_id = target_workspace_id
    and transaction_id = sale_row.id
    and movement_type = 'sale';

  if old_movement_count <> old_item_count then
    raise exception 'This sale does not have a consistent stock movement record';
  end if;

  -- Validate all requested product identifiers before locking products in a
  -- deterministic order. This keeps concurrent edits from deadlocking on
  -- different product-line orders.
  for line in select value from jsonb_array_elements(sale_payload->'items') loop
    if nullif(line->>'product_id', '') is null
       or line->>'product_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'A sale item has an invalid product';
    end if;

    line_product_id := (line->>'product_id')::uuid;
    if line_product_id = any(requested_product_ids) then
      raise exception 'A product can appear only once in a sale';
    end if;
    requested_product_ids := array_append(requested_product_ids, line_product_id);
  end loop;

  for product_row in
    select *
    from public.products
    where workspace_id = target_workspace_id
      and id = any(old_product_ids || requested_product_ids)
    order by id
    for update
  loop
    null;
  end loop;

  -- Validate every old stock movement and restore the sale's previous stock
  -- effect. The entire function is transactional, so any later failure rolls
  -- this restoration back automatically.
  for sale_item_row in
    select *
    from public.sale_items
    where transaction_id = sale_row.id
      and workspace_id = target_workspace_id
    order by line_number
  loop
    select * into product_row
    from public.products
    where id = sale_item_row.product_id
      and workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'A product attached to this sale no longer exists';
    end if;
    if product_row.sold_quantity < sale_item_row.quantity then
      raise exception 'This sale would make the product sold quantity negative';
    end if;
    if product_row.stock_quantity > 2147483647 - sale_item_row.quantity then
      raise exception 'The resulting stock quantity is too large';
    end if;

    select count(*), coalesce(sum(movement.quantity_delta), 0)
      into item_movement_count, item_movement_quantity
    from public.stock_movements movement
    where movement.workspace_id = target_workspace_id
      and movement.transaction_id = sale_row.id
      and movement.product_id = sale_item_row.product_id
      and movement.movement_type = 'sale';

    if item_movement_count <> 1 or item_movement_quantity <> -sale_item_row.quantity then
      raise exception 'This sale does not have a consistent product stock movement';
    end if;

    update public.products
    set stock_quantity = product_row.stock_quantity + sale_item_row.quantity,
        sold_quantity = product_row.sold_quantity - sale_item_row.quantity
    where id = product_row.id
      and workspace_id = target_workspace_id;
  end loop;

  -- Resolve each requested line using the original cost snapshot when the
  -- product was already on the sale; newly added lines use current product cost.
  for line in select value from jsonb_array_elements(sale_payload->'items') loop
    line_product_id := (line->>'product_id')::uuid;
    line_quantity := coalesce(nullif(line->>'quantity', '')::integer, 0);
    line_unit_price := round(coalesce(nullif(line->>'unit_selling_price', '')::numeric, 0), 2);
    line_discount := round(coalesce(nullif(line->>'discount', '')::numeric, 0), 2);

    if line_quantity <= 0 or line_unit_price <= 0 or line_discount < 0 then
      raise exception 'Quantity, selling price, and discount values must be valid';
    end if;
    if line_unit_price > 999999999999.99 or line_discount > 999999999999.99 then
      raise exception 'Sale line values are beyond the supported limit';
    end if;

    select * into product_row
    from public.products
    where id = line_product_id
      and workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists';
    end if;
    if line_quantity > product_row.stock_quantity then
      raise exception '% only has % units available', product_row.name, product_row.stock_quantity;
    end if;
    if line_quantity > 2147483647 - product_row.sold_quantity then
      raise exception 'The resulting sold quantity is too large';
    end if;

    select * into sale_item_row
    from public.sale_items
    where transaction_id = sale_row.id
      and workspace_id = target_workspace_id
      and product_id = line_product_id
    limit 1;

    if found then
      line_unit_cost := sale_item_row.unit_cost;
    else
      line_unit_cost := product_row.cost_price;
    end if;
    line_amount := round(line_quantity * line_unit_price - line_discount, 2);
    if line_discount > line_quantity * line_unit_price or line_amount < 0 then
      raise exception 'Discount cannot exceed the line subtotal for %', product_row.name;
    end if;
    if line_amount > 999999999999.99 then
      raise exception 'Sale line total is beyond the supported limit';
    end if;

    line_profit := round(line_amount - line_quantity * line_unit_cost, 2);
    if line_profit > 999999999999.99 or line_profit < -999999999999.99 then
      raise exception 'Sale line profit is beyond the supported limit';
    end if;
    if first_item_name is null then
      first_item_name := product_row.name;
    end if;
    if line_quantity > 2147483647 - total_quantity then
      raise exception 'The resulting sale quantity is too large';
    end if;
    total_quantity := total_quantity + line_quantity;
    total_amount := total_amount + line_amount;
    total_profit := total_profit + line_profit;
    if total_amount > 999999999999.99 then
      raise exception 'The sale total is beyond the supported limit';
    end if;
    if total_profit > 999999999999.99 or total_profit < -999999999999.99 then
      raise exception 'The sale profit is beyond the supported limit';
    end if;

    resolved_items := resolved_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name_snapshot', product_row.name,
      'sku_snapshot', product_row.sku,
      'color_snapshot', product_row.color,
      'quantity', line_quantity,
      'unit_selling_price', line_unit_price,
      'unit_cost', line_unit_cost,
      'discount', line_discount,
      'amount', line_amount,
      'profit', line_profit
    ));

    update public.products
    set stock_quantity = product_row.stock_quantity - line_quantity,
        sold_quantity = product_row.sold_quantity + line_quantity
    where id = product_row.id
      and workspace_id = target_workspace_id;
  end loop;

  delete from public.stock_movements
  where workspace_id = target_workspace_id
    and transaction_id = sale_row.id
    and movement_type = 'sale';

  delete from public.sale_items
  where transaction_id = sale_row.id
    and workspace_id = target_workspace_id;

  line_number := 0;
  for resolved_line in select value from jsonb_array_elements(resolved_items) loop
    line_number := line_number + 1;

    insert into public.sale_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot,
      sku_snapshot, color_snapshot, quantity, unit_selling_price, unit_cost,
      discount, amount, profit
    ) values (
      target_workspace_id,
      sale_row.id,
      line_number,
      (resolved_line->>'product_id')::uuid,
      resolved_line->>'name_snapshot',
      coalesce(resolved_line->>'sku_snapshot', ''),
      coalesce(resolved_line->>'color_snapshot', ''),
      (resolved_line->>'quantity')::integer,
      (resolved_line->>'unit_selling_price')::numeric,
      (resolved_line->>'unit_cost')::numeric,
      (resolved_line->>'discount')::numeric,
      (resolved_line->>'amount')::numeric,
      (resolved_line->>'profit')::numeric
    );

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type,
      quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id,
      (resolved_line->>'product_id')::uuid,
      sale_row.id,
      'sale',
      -(resolved_line->>'quantity')::integer,
      (resolved_line->>'unit_cost')::numeric,
      sale_row.occurred_on
    );
  end loop;

  update public.customers
  set name = requested_customer_name,
      updated_at = now()
  where id = customer_row.id
    and workspace_id = target_workspace_id;

  update public.transactions
  set name = case
    when requested_item_count = 1 then first_item_name
    else first_item_name || ' + ' || (requested_item_count - 1)::text || ' more'
  end,
      party = requested_customer_name,
      quantity = total_quantity,
      amount = total_amount,
      profit = total_profit
  where id = sale_row.id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'sale',
    sale_row.id,
    jsonb_build_object(
      'previous_customer_name', customer_row.name,
      'new_customer_name', requested_customer_name,
      'previous_item_count', old_item_count,
      'new_item_count', requested_item_count,
      'previous_quantity', old_quantity,
      'new_quantity', total_quantity,
      'previous_amount', old_total,
      'new_amount', total_amount,
      'previous_profit', old_profit,
      'new_profit', total_profit
    )
  );

  return sale_row.id;
end;
$$;

revoke all on function public.update_sale(uuid, uuid, jsonb) from public;
revoke all on function public.update_sale(uuid, uuid, jsonb) from anon;
revoke all on function public.update_sale(uuid, uuid, jsonb) from authenticated;
grant execute on function public.update_sale(uuid, uuid, jsonb) to authenticated;
