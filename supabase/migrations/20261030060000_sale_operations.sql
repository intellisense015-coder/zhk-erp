-- Atomic POS sale operation.
-- The browser submits intent only; totals, profit, stock, customer identity,
-- invoice numbering, and audit data are calculated and authorized here.

create or replace function public.record_sale(
  target_workspace_id uuid,
  sale_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_transaction_id uuid;
  invoice_number text;
  requested_customer_id uuid;
  resolved_customer_id uuid;
  requested_customer_name text := nullif(trim(coalesce(sale_payload->>'customer_name', '')), '');
  requested_contact text := regexp_replace(trim(coalesce(sale_payload->>'customer_contact_number', '')), '[^0-9]', '', 'g');
  requested_code text := upper(regexp_replace(trim(coalesce(sale_payload->>'customer_code', '')), '\s+', '', 'g'));
  owner_contact text;
  customer_row public.customers%rowtype;
  line jsonb;
  product_row public.products%rowtype;
  line_product_id uuid;
  line_quantity integer;
  line_unit_price numeric;
  line_discount numeric;
  line_amount numeric;
  line_profit numeric;
  total_quantity integer := 0;
  total_amount numeric := 0;
  total_profit numeric := 0;
  line_number integer := 0;
  product_ids uuid[] := ARRAY[]::uuid[];
  sale_date date := (now() at time zone 'Asia/Karachi')::date;
  item_count integer;
  first_item_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if coalesce(jsonb_typeof(sale_payload->'items'), '') <> 'array' then
    raise exception 'A sale must contain at least one item';
  end if;

  item_count := coalesce(jsonb_array_length(sale_payload->'items'), 0);
  if item_count < 1 or item_count > 50 then
    raise exception 'A sale can contain between 1 and 50 items';
  end if;

  if requested_customer_name is null or requested_contact = '' or requested_code = '' then
    raise exception 'Customer name, contact number, and customer code are required';
  end if;

  if requested_contact !~ '^[0-9]{7,15}$' then
    raise exception 'Customer contact number is invalid';
  end if;

  select regexp_replace(owner_contact_number, '[^0-9]', '', 'g')
    into owner_contact
    from public.workspaces
   where id = target_workspace_id;
  if owner_contact is null then
    raise exception 'Workspace was not found';
  end if;
  if owner_contact <> '' and owner_contact = requested_contact then
    raise exception 'The business owner contact cannot be used as a customer contact';
  end if;

  if nullif(sale_payload->>'customer_id', '') is not null then
    if sale_payload->>'customer_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Customer selection is invalid';
    end if;
    requested_customer_id := (sale_payload->>'customer_id')::uuid;
  end if;

  if requested_customer_id is not null then
    select * into customer_row
      from public.customers
     where id = requested_customer_id
       and workspace_id = target_workspace_id
     for update;
    if not found then
      raise exception 'Selected customer was not found in this workspace';
    end if;
  else
    select * into customer_row
      from public.customers
     where workspace_id = target_workspace_id
       and contact_number = requested_contact
     for update;
    if not found then
      select * into customer_row
        from public.customers
       where workspace_id = target_workspace_id
         and code = requested_code
       for update;
    end if;
  end if;

  if customer_row.id is not null then
    if customer_row.contact_number <> requested_contact then
      raise exception 'This contact number is already assigned to another customer';
    end if;
    if customer_row.code <> requested_code and exists (
      select 1 from public.customers
       where workspace_id = target_workspace_id
         and code = requested_code
         and id <> customer_row.id
    ) then
      raise exception 'This customer code is already assigned to another customer';
    end if;
    resolved_customer_id := customer_row.id;
    update public.customers
       set name = requested_customer_name,
           contact_number = requested_contact,
           code = requested_code,
           updated_at = now()
     where id = resolved_customer_id;
  else
    if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = requested_contact) then
      raise exception 'This contact number belongs to a supplier and cannot be reused for a customer';
    end if;
    insert into public.customers (workspace_id, name, contact_number, code, created_at, updated_at)
    values (target_workspace_id, requested_customer_name, requested_contact, requested_code, now(), now())
    returning id into resolved_customer_id;
  end if;

  -- Lock and validate every product before writing any sale data.
  for line in select value from jsonb_array_elements(sale_payload->'items') loop
    if nullif(line->>'product_id', '') is null
       or line->>'product_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'A sale item has an invalid product';
    end if;
    line_product_id := (line->>'product_id')::uuid;
    if line_product_id = any(product_ids) then
      raise exception 'A product can appear only once in a sale';
    end if;
    product_ids := array_append(product_ids, line_product_id);

    line_quantity := coalesce(nullif(line->>'quantity', '')::integer, 0);
    line_unit_price := coalesce(nullif(line->>'unit_selling_price', '')::numeric, 0);
    line_discount := coalesce(nullif(line->>'discount', '')::numeric, 0);
    if line_quantity <= 0 or line_unit_price <= 0 or line_discount < 0 then
      raise exception 'Quantity, selling price, and discount values must be valid';
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

    line_amount := line_quantity * line_unit_price - line_discount;
    if line_discount > line_quantity * line_unit_price or line_amount < 0 then
      raise exception 'Discount cannot exceed the line subtotal for %', product_row.name;
    end if;
    if first_item_name is null then first_item_name := product_row.name; end if;
    total_quantity := total_quantity + line_quantity;
    total_amount := total_amount + line_amount;
    total_profit := total_profit + line_amount - line_quantity * product_row.cost_price;
  end loop;

  invoice_number := public.next_invoice_number(target_workspace_id, sale_date);
  insert into public.transactions (
    workspace_id, transaction_type, invoice_number, name, party, quantity,
    amount, profit, time_label, occurred_on, customer_id,
    customer_contact_number, customer_code, created_by
  ) values (
    target_workspace_id, 'sale', invoice_number,
    case when item_count = 1 then first_item_name else first_item_name || ' + ' || (item_count - 1)::text || ' more' end,
    requested_customer_name, total_quantity, total_amount, total_profit,
    to_char(now() at time zone 'Asia/Karachi', 'HH12:MI AM'), sale_date,
    resolved_customer_id, requested_contact, requested_code, auth.uid()
  ) returning id into sale_transaction_id;

  line_number := 0;
  for line in select value from jsonb_array_elements(sale_payload->'items') loop
    line_number := line_number + 1;
    line_product_id := (line->>'product_id')::uuid;
    line_quantity := (line->>'quantity')::integer;
    line_unit_price := (line->>'unit_selling_price')::numeric;
    line_discount := coalesce(nullif(line->>'discount', '')::numeric, 0);
    select * into product_row from public.products where id = line_product_id and workspace_id = target_workspace_id for update;
    line_amount := line_quantity * line_unit_price - line_discount;
    line_profit := line_amount - line_quantity * product_row.cost_price;

    insert into public.sale_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot,
      sku_snapshot, color_snapshot, quantity, unit_selling_price, unit_cost,
      discount, amount, profit
    ) values (
      target_workspace_id, sale_transaction_id, line_number, product_row.id,
      product_row.name, product_row.sku, product_row.color, line_quantity,
      line_unit_price, product_row.cost_price, line_discount, line_amount,
      line_profit
    );

    update public.products
       set stock_quantity = stock_quantity - line_quantity,
           sold_quantity = sold_quantity + line_quantity,
           updated_at = now()
     where id = product_row.id;

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type,
      quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id, product_row.id, sale_transaction_id, 'sale',
      -line_quantity, product_row.cost_price, sale_date
    );
  end loop;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'create', 'sale', sale_transaction_id,
    jsonb_build_object('invoice_number', invoice_number, 'amount', total_amount, 'quantity', total_quantity)
  );

  return sale_transaction_id;
end;
$$;

revoke all on function public.record_sale(uuid, jsonb) from public;
grant execute on function public.record_sale(uuid, jsonb) to authenticated;
