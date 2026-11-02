-- Atomic exchange and buyback operation.
-- A buyback creates one customer-trade-in purchase. An exchange creates that
-- purchase plus a linked sale and, when needed, a linked supplier purchase and
-- payment. All records, stock changes, and audit entries commit together.

create or replace function public.record_exchange(
  target_workspace_id uuid,
  exchange_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_mode text := lower(trim(coalesce(exchange_payload->>'mode', '')));
  requested_customer_id_text text := nullif(trim(coalesce(exchange_payload->>'customer_id', '')), '');
  requested_supplier_id_text text := nullif(trim(coalesce(exchange_payload->>'supplier_id', '')), '');
  requested_customer_name text := nullif(trim(coalesce(exchange_payload->>'customer_name', '')), '');
  requested_contact text := regexp_replace(trim(coalesce(exchange_payload->>'customer_contact_number', '')), '[^0-9]', '', 'g');
  requested_code text := upper(regexp_replace(trim(coalesce(exchange_payload->>'customer_code', '')), '\s+', '', 'g'));
  requested_receive_source text := coalesce(nullif(lower(trim(exchange_payload->>'receive_source')), ''), 'inventory');
  given_product_id_text text := nullif(trim(coalesce(exchange_payload->>'given_product_id', '')), '');
  received_product_id_text text := nullif(trim(coalesce(exchange_payload->>'received_product_id', '')), '');
  given_quantity_text text := trim(coalesce(exchange_payload->>'given_quantity', ''));
  received_quantity_text text := trim(coalesce(exchange_payload->>'received_quantity', ''));
  trade_in_value_text text := trim(coalesce(exchange_payload->>'trade_in_unit_value', ''));
  received_price_text text := trim(coalesce(exchange_payload->>'received_unit_selling_price', ''));
  supplier_cost_text text := trim(coalesce(exchange_payload->>'supplier_unit_cost', '0'));
  supplier_paid_text text := trim(coalesce(exchange_payload->>'supplier_paid_amount', '0'));
  requested_supplier_name text := nullif(trim(coalesce(exchange_payload->>'supplier_name', '')), '');
  requested_supplier_contact text := regexp_replace(trim(coalesce(exchange_payload->>'supplier_contact_number', '')), '[^0-9]', '', 'g');
  requested_supplier_company text := trim(coalesce(exchange_payload->>'supplier_company', ''));
  requested_customer_id uuid;
  requested_supplier_id uuid;
  given_product_id uuid;
  received_product_id uuid;
  resolved_customer_id uuid;
  resolved_supplier_id uuid;
  given_quantity integer;
  replacement_quantity integer := 0;
  trade_in_unit_value numeric;
  received_unit_selling_price numeric := 0;
  supplier_unit_cost numeric := 0;
  supplier_paid_amount numeric := 0;
  trade_in_total numeric;
  sale_total numeric := 0;
  supplier_total numeric := 0;
  amount_due numeric := 0;
  receiving_unit_cost numeric;
  sale_profit numeric := 0;
  owner_contact text;
  exchange_id text := 'exchange-' || gen_random_uuid()::text;
  exchange_date date := (now() at time zone 'Asia/Karachi')::date;
  time_label text := to_char(now() at time zone 'Asia/Karachi', 'HH12:MI AM');
  customer_row public.customers%rowtype;
  supplier_row public.suppliers%rowtype;
  given_product_row public.products%rowtype;
  received_product_row public.products%rowtype;
  customer_was_created boolean := false;
  supplier_was_created boolean := false;
  customer_previous_name text;
  buyback_transaction_id uuid;
  purchase_transaction_id uuid;
  sale_transaction_id uuid;
  buyback_invoice_number text;
  purchase_invoice_number text;
  sale_invoice_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required for exchanges and buybacks';
  end if;

  if requested_mode not in ('exchange', 'buyback') then
    raise exception 'Unsupported exchange operation';
  end if;
  if requested_receive_source not in ('inventory', 'supplier') then
    raise exception 'Unsupported replacement source';
  end if;
  if requested_customer_name is null or length(requested_customer_name) > 200 then
    raise exception 'Customer name is required and must be 200 characters or less';
  end if;
  if requested_contact !~ '^[0-9]{7,15}$' then
    raise exception 'Customer contact number is invalid';
  end if;
  if requested_code !~ '^[A-Z0-9_-]{3,50}$' then
    raise exception 'Customer code is invalid';
  end if;
  if given_product_id_text is null
     or given_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'The customer phone selection is invalid';
  end if;
  if requested_mode = 'exchange'
     and (received_product_id_text is null
       or received_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'The replacement phone selection is invalid';
  end if;

  if requested_customer_id_text is not null then
    if requested_customer_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Customer selection is invalid';
    end if;
    requested_customer_id := requested_customer_id_text::uuid;
  end if;
  if requested_supplier_id_text is not null then
    if requested_supplier_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Supplier selection is invalid';
    end if;
    requested_supplier_id := requested_supplier_id_text::uuid;
  end if;

  if given_quantity_text !~ '^[0-9]+$'
     or (requested_mode = 'exchange' and received_quantity_text !~ '^[0-9]+$') then
    raise exception 'Quantities must be whole numbers';
  end if;
  if trade_in_value_text !~ '^[0-9]+([.][0-9]+)?$'
     or (requested_mode = 'exchange' and received_price_text !~ '^[0-9]+([.][0-9]+)?$') then
    raise exception 'Trade-in and selling prices must be valid numbers';
  end if;
  if requested_receive_source = 'supplier'
     and (supplier_cost_text !~ '^[0-9]+([.][0-9]+)?$' or supplier_paid_text !~ '^[0-9]+([.][0-9]+)?$') then
    raise exception 'Supplier cost and payment must be valid numbers';
  end if;

  given_quantity := given_quantity_text::integer;
  if requested_mode = 'exchange' then
    replacement_quantity := received_quantity_text::integer;
  end if;
  trade_in_unit_value := round(trade_in_value_text::numeric, 2);
  if requested_mode = 'exchange' then
    received_unit_selling_price := round(received_price_text::numeric, 2);
  end if;
  if requested_receive_source = 'supplier' then
    supplier_unit_cost := round(supplier_cost_text::numeric, 2);
    supplier_paid_amount := round(supplier_paid_text::numeric, 2);
  end if;

  if given_quantity <= 0 or trade_in_unit_value <= 0 then
    raise exception 'Trade-in quantity and value must be greater than zero';
  end if;
  if requested_mode = 'exchange'
     and (replacement_quantity <= 0 or received_unit_selling_price <= 0) then
    raise exception 'Replacement quantity and selling price must be greater than zero';
  end if;
  if trade_in_unit_value > 999999999999.99
     or received_unit_selling_price > 999999999999.99
     or supplier_unit_cost > 999999999999.99 then
    raise exception 'Exchange values are beyond the supported limit';
  end if;
  if requested_receive_source = 'supplier' and supplier_paid_amount < 0 then
    raise exception 'Supplier payment cannot be negative';
  end if;

  given_product_id := given_product_id_text::uuid;
  if requested_mode = 'exchange' then
    received_product_id := received_product_id_text::uuid;
    if given_product_id = received_product_id then
      raise exception 'The trade-in and replacement phone must be different products';
    end if;
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

  if requested_customer_id is not null then
    select * into customer_row
    from public.customers
    where id = requested_customer_id
      and workspace_id = target_workspace_id
    for update;
    if not found then
      raise exception 'Selected customer was not found in this workspace';
    end if;
    if customer_row.contact_number <> requested_contact then
      raise exception 'The selected customer contact cannot be changed here';
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
    else
      if exists (
        select 1 from public.suppliers
        where workspace_id = target_workspace_id
          and contact_number = requested_contact
      ) then
        raise exception 'This contact number belongs to a supplier and cannot be reused for a customer';
      end if;
      insert into public.customers (
        workspace_id, name, contact_number, gender, cnic_number, code, created_at, updated_at
      ) values (
        target_workspace_id, requested_customer_name, requested_contact, '', '', requested_code, now(), now()
      )
      returning id into resolved_customer_id;
      customer_was_created := true;
    end if;
  end if;
  customer_previous_name := customer_row.name;

  -- Product locks are acquired in ID order after the customer lock so
  -- concurrent sales and exchanges serialize safely on the same stock rows.
  for given_product_row in
    select *
    from public.products
    where workspace_id = target_workspace_id
      and id = any(case when requested_mode = 'exchange' then array[given_product_id, received_product_id] else array[given_product_id] end)
    order by id
    for update
  loop
    null;
  end loop;

  select * into given_product_row
  from public.products
  where id = given_product_id
    and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'The selected customer phone no longer exists';
  end if;

  if requested_mode = 'exchange' then
    select * into received_product_row
    from public.products
    where id = received_product_id
      and workspace_id = target_workspace_id
    for update;
    if not found then
      raise exception 'The selected replacement phone no longer exists';
    end if;
  end if;

  if given_product_row.stock_quantity > 2147483647 - given_quantity
     or given_product_row.received_quantity > 2147483647 - given_quantity then
    raise exception 'The resulting trade-in stock is too large';
  end if;

  if requested_mode = 'exchange' then
    if requested_receive_source = 'inventory' and replacement_quantity > received_product_row.stock_quantity then
      raise exception '% only has % units available. Choose supplier arrangement or add stock first', received_product_row.name, received_product_row.stock_quantity;
    end if;
    if received_product_row.sold_quantity > 2147483647 - replacement_quantity then
      raise exception 'The resulting sold quantity is too large';
    end if;
    if requested_receive_source = 'supplier'
       and received_product_row.received_quantity > 2147483647 - replacement_quantity then
      raise exception 'The resulting received quantity is too large';
    end if;
  end if;

  if requested_receive_source = 'supplier' and requested_mode = 'exchange' then
    if requested_supplier_id is not null then
      select * into supplier_row
      from public.suppliers
      where id = requested_supplier_id
        and workspace_id = target_workspace_id
      for update;
      if not found then
        raise exception 'Selected supplier was not found in this workspace';
      end if;
      resolved_supplier_id := supplier_row.id;
    else
      if requested_supplier_name is null or requested_supplier_contact !~ '^[0-9]{7,15}$' then
        raise exception 'Supplier name and contact number are required';
      end if;
      if length(requested_supplier_name) > 200 or length(requested_supplier_company) > 200 then
        raise exception 'Supplier details are too long';
      end if;
      if owner_contact <> '' and owner_contact = requested_supplier_contact then
        raise exception 'The business owner number cannot be used as a supplier contact';
      end if;
      if exists (
        select 1 from public.customers
        where workspace_id = target_workspace_id
          and contact_number = requested_supplier_contact
      ) then
        raise exception 'This supplier contact number belongs to a customer';
      end if;
      if exists (
        select 1 from public.suppliers
        where workspace_id = target_workspace_id
          and contact_number = requested_supplier_contact
      ) then
        raise exception 'This supplier contact number is already assigned';
      end if;
      insert into public.suppliers (
        workspace_id, name, contact_number, company, cnic_number, opening_balance
      ) values (
        target_workspace_id, requested_supplier_name, requested_supplier_contact,
        requested_supplier_company, '', 0
      )
      returning id into resolved_supplier_id;
      supplier_row.id := resolved_supplier_id;
      supplier_row.name := requested_supplier_name;
      supplier_row.contact_number := requested_supplier_contact;
      supplier_row.company := requested_supplier_company;
      supplier_was_created := true;
    end if;
  end if;

  trade_in_total := round(given_quantity * trade_in_unit_value, 2);
  if trade_in_total > 999999999999.99 then
    raise exception 'The trade-in total is beyond the supported limit';
  end if;

  if requested_mode = 'exchange' then
    if requested_receive_source = 'supplier' then
      supplier_total := round(replacement_quantity * supplier_unit_cost, 2);
      if supplier_total > 999999999999.99 or supplier_paid_amount > 999999999999.99 then
        raise exception 'The supplier purchase values are beyond the supported limit';
      end if;
      if supplier_paid_amount > supplier_total then
        raise exception 'Supplier payment cannot exceed the supplier purchase total';
      end if;
      receiving_unit_cost := supplier_unit_cost;
    else
      receiving_unit_cost := received_product_row.cost_price;
    end if;
    sale_total := round(replacement_quantity * received_unit_selling_price, 2);
    amount_due := sale_total - trade_in_total;
    sale_profit := round(sale_total - replacement_quantity * receiving_unit_cost, 2);
    if sale_total > 999999999999.99
       or sale_profit > 999999999999.99
       or sale_profit < -999999999999.99 then
      raise exception 'The exchange sale values are beyond the supported limit';
    end if;
  end if;

  -- Update the customer snapshot only after all identity checks pass.
  update public.customers
  set name = requested_customer_name,
      contact_number = requested_contact,
      code = requested_code,
      updated_at = now()
  where id = resolved_customer_id
    and workspace_id = target_workspace_id;

  buyback_invoice_number := public.next_invoice_number(target_workspace_id, exchange_date);
  insert into public.transactions (
    workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
    time_label, occurred_on, customer_id, customer_contact_number, customer_code,
    product_id, unit_cost, source, exchange_id, paid_amount, outstanding_amount, created_by
  ) values (
    target_workspace_id, 'purchase', buyback_invoice_number, given_product_row.name,
    requested_customer_name, given_quantity, trade_in_total, time_label, exchange_date,
    resolved_customer_id, requested_contact, requested_code, given_product_row.id,
    trade_in_unit_value, 'customer-trade-in', exchange_id, trade_in_total, 0, auth.uid()
  ) returning id into buyback_transaction_id;

  insert into public.purchase_items (
    workspace_id, transaction_id, line_number, product_id, name_snapshot, quantity, unit_cost, amount
  ) values (
    target_workspace_id, buyback_transaction_id, 1, given_product_row.id,
    given_product_row.name, given_quantity, trade_in_unit_value, trade_in_total
  );

  insert into public.stock_movements (
    workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
  ) values (
    target_workspace_id, given_product_row.id, buyback_transaction_id, 'trade-in',
    given_quantity, trade_in_unit_value, exchange_date
  );

  update public.products
  set stock_quantity = stock_quantity + given_quantity,
      received_quantity = received_quantity + given_quantity,
      cost_price = trade_in_unit_value
  where id = given_product_row.id
    and workspace_id = target_workspace_id;

  if requested_mode = 'exchange' and requested_receive_source = 'supplier' then
    purchase_invoice_number := public.next_invoice_number(target_workspace_id, exchange_date);
    insert into public.transactions (
      workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
      time_label, occurred_on, supplier_id, supplier_contact_number, supplier_company,
      product_id, unit_cost, source, exchange_id, paid_amount, outstanding_amount,
      funding_source, created_by
    ) values (
      target_workspace_id, 'purchase', purchase_invoice_number, received_product_row.name,
      supplier_row.name, replacement_quantity, supplier_total, time_label, exchange_date,
      resolved_supplier_id, supplier_row.contact_number, supplier_row.company,
      received_product_row.id, supplier_unit_cost, 'supplier', exchange_id,
      supplier_paid_amount, supplier_total - supplier_paid_amount, 'other', auth.uid()
    ) returning id into purchase_transaction_id;

    insert into public.purchase_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot, quantity, unit_cost, amount
    ) values (
      target_workspace_id, purchase_transaction_id, 1, received_product_row.id,
      received_product_row.name, replacement_quantity, supplier_unit_cost, supplier_total
    );

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id, received_product_row.id, purchase_transaction_id, 'purchase',
      replacement_quantity, supplier_unit_cost, exchange_date
    );

    if supplier_paid_amount > 0 then
      insert into public.supplier_payments (
        workspace_id, supplier_id, amount, note, occurred_on, purchase_transaction_id
      ) values (
        target_workspace_id, resolved_supplier_id, supplier_paid_amount,
        'Paid with exchange arrangement', exchange_date, purchase_transaction_id
      );
    end if;
  end if;

  if requested_mode = 'exchange' then
    sale_invoice_number := public.next_invoice_number(target_workspace_id, exchange_date);
    insert into public.transactions (
      workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
      profit, time_label, occurred_on, customer_id, customer_contact_number,
      customer_code, product_id, source, exchange_id, trade_in_credit, amount_due, created_by
    ) values (
      target_workspace_id, 'sale', sale_invoice_number, received_product_row.name,
      requested_customer_name, replacement_quantity, sale_total, sale_profit, time_label,
      resolved_customer_id, requested_contact, requested_code, received_product_row.id,
      'exchange', exchange_id, trade_in_total, amount_due, auth.uid()
    ) returning id into sale_transaction_id;

    insert into public.sale_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot, sku_snapshot,
      color_snapshot, quantity, unit_selling_price, unit_cost, discount, amount, profit
    ) values (
      target_workspace_id, sale_transaction_id, 1, received_product_row.id,
      received_product_row.name, received_product_row.sku, received_product_row.color,
      replacement_quantity, received_unit_selling_price, receiving_unit_cost, 0,
      sale_total, sale_profit
    );

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id, received_product_row.id, sale_transaction_id, 'sale',
      -replacement_quantity, receiving_unit_cost, exchange_date
    );

    update public.products
    set stock_quantity = case
        when requested_receive_source = 'supplier' then stock_quantity
        else stock_quantity - replacement_quantity
      end,
      received_quantity = case
        when requested_receive_source = 'supplier' then received_quantity + replacement_quantity
        else received_quantity
      end,
      sold_quantity = sold_quantity + replacement_quantity,
      cost_price = case
        when requested_receive_source = 'supplier' then supplier_unit_cost
        else cost_price
      end,
      vendor_name = case
        when requested_receive_source = 'supplier' then supplier_row.name
        else vendor_name
      end,
      vendor_contact_number = case
        when requested_receive_source = 'supplier' then supplier_row.contact_number
        else vendor_contact_number
      end,
      vendor_company = case
        when requested_receive_source = 'supplier' then supplier_row.company
        else vendor_company
      end
    where id = received_product_row.id
      and workspace_id = target_workspace_id;
  end if;

  if customer_was_created then
    insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
    values (target_workspace_id, auth.uid(), 'create', 'customer', resolved_customer_id,
      jsonb_build_object('name', requested_customer_name, 'contact_number', requested_contact, 'code', requested_code));
  elsif customer_previous_name is distinct from requested_customer_name then
    insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
    values (target_workspace_id, auth.uid(), 'update', 'customer', resolved_customer_id,
      jsonb_build_object('previous_name', customer_previous_name, 'new_name', requested_customer_name));
  end if;

  if supplier_was_created then
    insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
    values (target_workspace_id, auth.uid(), 'create', 'supplier', resolved_supplier_id,
      jsonb_build_object('name', supplier_row.name, 'contact_number', supplier_row.contact_number, 'company', supplier_row.company));
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'create',
    'exchange',
    buyback_transaction_id,
    jsonb_build_object(
      'exchange_id', exchange_id,
      'mode', requested_mode,
      'buyback_transaction_id', buyback_transaction_id,
      'purchase_transaction_id', purchase_transaction_id,
      'sale_transaction_id', sale_transaction_id,
      'trade_in_total', trade_in_total,
      'sale_total', sale_total,
      'amount_due', amount_due
    )
  );

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'create', 'purchase', buyback_transaction_id,
    jsonb_build_object('source', 'customer-trade-in', 'exchange_id', exchange_id, 'amount', trade_in_total)
  );

  if purchase_transaction_id is not null then
    insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
    values (
      target_workspace_id, auth.uid(), 'create', 'purchase', purchase_transaction_id,
      jsonb_build_object('source', 'supplier', 'exchange_id', exchange_id, 'amount', supplier_total)
    );
  end if;
  if sale_transaction_id is not null then
    insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
    values (
      target_workspace_id, auth.uid(), 'create', 'sale', sale_transaction_id,
      jsonb_build_object('source', 'exchange', 'exchange_id', exchange_id, 'amount', sale_total, 'amount_due', amount_due)
    );
  end if;

  return buyback_transaction_id;
end;
$$;

revoke all on function public.record_exchange(uuid, jsonb) from public;
revoke all on function public.record_exchange(uuid, jsonb) from anon;
revoke all on function public.record_exchange(uuid, jsonb) from authenticated;
grant execute on function public.record_exchange(uuid, jsonb) to authenticated;
