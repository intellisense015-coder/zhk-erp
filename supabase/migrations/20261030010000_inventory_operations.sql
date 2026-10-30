-- Secure inventory write operations.
-- Browser clients call these RPCs; direct table writes remain disabled.

create or replace function public.create_product(
  target_workspace_id uuid,
  product_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_product_id uuid;
  new_transaction_id uuid;
  new_invoice_number text;
  supplier_id uuid;
  supplier_contact text;
  supplier_company text;
  product_name text := nullif(trim(coalesce(product_payload->>'name', '')), '');
  product_sku text := nullif(upper(trim(coalesce(product_payload->>'sku', ''))), '');
  product_brand text := trim(coalesce(product_payload->>'brand', ''));
  product_model text := trim(coalesce(product_payload->>'model', ''));
  product_color text := nullif(trim(coalesce(product_payload->>'color', '')), '');
  product_category text := nullif(trim(coalesce(product_payload->>'category', '')), '');
  vendor_name text := nullif(trim(coalesce(product_payload->>'vendor_name', '')), '');
  vendor_contact text := regexp_replace(trim(coalesce(product_payload->>'vendor_contact_number', '')), '[^0-9]', '', 'g');
  vendor_company text := trim(coalesce(product_payload->>'vendor_company', ''));
  description text := nullif(trim(coalesce(product_payload->>'description', '')), '');
  image_url text := nullif(trim(coalesce(product_payload->>'image_url', '')), '');
  image_source text := nullif(trim(coalesce(product_payload->>'image_source', '')), '');
  product_cost numeric := coalesce(nullif(product_payload->>'cost_price', '')::numeric, 0);
  product_price numeric := coalesce(nullif(product_payload->>'selling_price', '')::numeric, 0);
  stock_quantity integer := coalesce(nullif(product_payload->>'in_stock_quantity', '')::integer, 0);
  reorder_level integer := coalesce(nullif(product_payload->>'reorder_level', '')::integer, 0);
  purchase_total numeric;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required for inventory changes';
  end if;

  if product_name is null or product_sku is null or product_color is null or product_category is null or vendor_name is null then
    raise exception 'Product, SKU, color, category, and supplier are required';
  end if;
  if product_cost <= 0 or product_price <= 0 then
    raise exception 'Cost and selling prices must be greater than zero';
  end if;
  if stock_quantity < 0 or reorder_level < 0 then
    raise exception 'Stock and reorder levels cannot be negative';
  end if;
  if image_source is not null and image_source <> 'catalog' then
    raise exception 'Unsupported product image source';
  end if;

  if exists (
    select 1 from public.products
    where workspace_id = target_workspace_id
      and lower(name) = lower(product_name)
      and lower(color) = lower(product_color)
  ) then
    raise exception 'A product with this model and color already exists';
  end if;
  if exists (
    select 1 from public.products
    where workspace_id = target_workspace_id
      and upper(sku) = product_sku
  ) then
    raise exception 'A product with this SKU already exists';
  end if;

  select id, contact_number, company
    into supplier_id, supplier_contact, supplier_company
  from public.suppliers
  where workspace_id = target_workspace_id
    and lower(name) = lower(vendor_name)
  order by created_at
  limit 1;

  if supplier_id is null then
    if vendor_contact = '' then
      raise exception 'A contact number is required for a new supplier';
    end if;
    if exists (
      select 1 from public.customers
      where workspace_id = target_workspace_id
        and contact_number = vendor_contact
    ) then
      raise exception 'This contact number belongs to a customer';
    end if;
    if exists (
      select 1 from public.suppliers
      where workspace_id = target_workspace_id
        and contact_number = vendor_contact
    ) then
      raise exception 'This supplier contact number is already assigned';
    end if;
    if exists (
      select 1 from public.workspaces
      where id = target_workspace_id
        and regexp_replace(owner_contact_number, '[^0-9]', '', 'g') = vendor_contact
    ) then
      raise exception 'The business owner number cannot be used as a supplier contact';
    end if;

    insert into public.suppliers (workspace_id, name, contact_number, company)
    values (target_workspace_id, vendor_name, vendor_contact, vendor_company)
    returning id, contact_number, company into supplier_id, supplier_contact, supplier_company;
  end if;

  insert into public.products (
    workspace_id, name, sku, brand, model, color, description, image_url, image_source,
    category, cost_price, selling_price, stock_quantity, reorder_level,
    vendor_name, vendor_contact_number, vendor_company, sold_quantity, received_quantity
  )
  values (
    target_workspace_id, product_name, product_sku, product_brand, product_model, product_color,
    description, image_url, image_source, product_category, product_cost, product_price,
    stock_quantity, reorder_level, vendor_name, supplier_contact, supplier_company, 0, stock_quantity
  )
  returning id into new_product_id;

  if stock_quantity > 0 then
    purchase_total := stock_quantity * product_cost;
    new_invoice_number := public.next_invoice_number(target_workspace_id, current_date);

    insert into public.transactions (
      workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
      time_label, occurred_on, supplier_id, supplier_contact_number, supplier_company,
      product_id, unit_cost, source, paid_amount, outstanding_amount, created_by
    )
    values (
      target_workspace_id, 'purchase', new_invoice_number, product_name, vendor_name,
      stock_quantity, purchase_total, 'Recorded', current_date, supplier_id, supplier_contact,
      supplier_company, new_product_id, product_cost, 'supplier', 0, purchase_total, auth.uid()
    )
    returning id into new_transaction_id;

    insert into public.purchase_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot, quantity, unit_cost, amount
    ) values (
      target_workspace_id, new_transaction_id, 1, new_product_id, product_name,
      stock_quantity, product_cost, purchase_total
    );

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id, new_product_id, new_transaction_id, 'purchase', stock_quantity, product_cost, current_date
    );
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'product', new_product_id, product_payload);

  return new_product_id;
end;
$$;

create or replace function public.update_product(
  target_workspace_id uuid,
  target_product_id uuid,
  product_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_product public.products%rowtype;
  new_transaction_id uuid;
  new_invoice_number text;
  supplier_id uuid;
  supplier_contact text;
  supplier_company text;
  product_name text := nullif(trim(coalesce(product_payload->>'name', '')), '');
  product_sku text := nullif(upper(trim(coalesce(product_payload->>'sku', ''))), '');
  product_brand text := trim(coalesce(product_payload->>'brand', ''));
  product_model text := trim(coalesce(product_payload->>'model', ''));
  product_color text := nullif(trim(coalesce(product_payload->>'color', '')), '');
  product_category text := nullif(trim(coalesce(product_payload->>'category', '')), '');
  new_vendor_name text := nullif(trim(coalesce(product_payload->>'vendor_name', '')), '');
  vendor_contact text := regexp_replace(trim(coalesce(product_payload->>'vendor_contact_number', '')), '[^0-9]', '', 'g');
  vendor_company text := trim(coalesce(product_payload->>'vendor_company', ''));
  new_description text := nullif(trim(coalesce(product_payload->>'description', '')), '');
  new_image_url text := nullif(trim(coalesce(product_payload->>'image_url', '')), '');
  new_image_source text := nullif(trim(coalesce(product_payload->>'image_source', '')), '');
  product_cost numeric := coalesce(nullif(product_payload->>'cost_price', '')::numeric, 0);
  product_price numeric := coalesce(nullif(product_payload->>'selling_price', '')::numeric, 0);
  new_stock_quantity integer := coalesce(nullif(product_payload->>'in_stock_quantity', '')::integer, 0);
  new_reorder_level integer := coalesce(nullif(product_payload->>'reorder_level', '')::integer, 0);
  stock_increase integer;
  purchase_total numeric;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required for inventory changes';
  end if;

  select * into existing_product
  from public.products
  where id = target_product_id and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'Product not found';
  end if;

  if product_name is null or product_sku is null or product_color is null or product_category is null or new_vendor_name is null then
    raise exception 'Product, SKU, color, category, and supplier are required';
  end if;
  if product_cost <= 0 or product_price <= 0 then
    raise exception 'Cost and selling prices must be greater than zero';
  end if;
  if new_stock_quantity < 0 or new_reorder_level < 0 then
    raise exception 'Stock and reorder levels cannot be negative';
  end if;
  if new_image_source is not null and new_image_source <> 'catalog' then
    raise exception 'Unsupported product image source';
  end if;

  if exists (
    select 1 from public.products
    where workspace_id = target_workspace_id
      and id <> target_product_id
      and lower(name) = lower(product_name)
      and lower(color) = lower(product_color)
  ) then
    raise exception 'Another product already uses this model and color';
  end if;
  if exists (
    select 1 from public.products
    where workspace_id = target_workspace_id
      and id <> target_product_id
      and upper(sku) = product_sku
  ) then
    raise exception 'Another product already uses this SKU';
  end if;

  select id, contact_number, company
    into supplier_id, supplier_contact, supplier_company
  from public.suppliers
  where workspace_id = target_workspace_id
    and lower(name) = lower(new_vendor_name)
  order by created_at
  limit 1;

  if supplier_id is null then
    if vendor_contact = '' then
      raise exception 'A contact number is required for a new supplier';
    end if;
    if exists (select 1 from public.customers where workspace_id = target_workspace_id and contact_number = vendor_contact) then
      raise exception 'This contact number belongs to a customer';
    end if;
    if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = vendor_contact) then
      raise exception 'This supplier contact number is already assigned';
    end if;
    if exists (
      select 1 from public.workspaces
      where id = target_workspace_id
        and regexp_replace(owner_contact_number, '[^0-9]', '', 'g') = vendor_contact
    ) then
      raise exception 'The business owner number cannot be used as a supplier contact';
    end if;
    insert into public.suppliers (workspace_id, name, contact_number, company)
    values (target_workspace_id, new_vendor_name, vendor_contact, vendor_company)
    returning id, contact_number, company into supplier_id, supplier_contact, supplier_company;
  end if;

  stock_increase := new_stock_quantity - existing_product.stock_quantity;

  update public.products
  set name = product_name,
      sku = product_sku,
      brand = product_brand,
      model = product_model,
      color = product_color,
      description = new_description,
      image_url = new_image_url,
      image_source = new_image_source,
      category = product_category,
      cost_price = product_cost,
      selling_price = product_price,
      stock_quantity = new_stock_quantity,
      reorder_level = new_reorder_level,
      vendor_name = new_vendor_name,
      vendor_contact_number = supplier_contact,
      vendor_company = supplier_company,
      received_quantity = existing_product.received_quantity + greatest(stock_increase, 0)
  where id = target_product_id and workspace_id = target_workspace_id;

  if stock_increase > 0 then
    purchase_total := stock_increase * product_cost;
    new_invoice_number := public.next_invoice_number(target_workspace_id, current_date);
    insert into public.transactions (
      workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
      time_label, occurred_on, supplier_id, supplier_contact_number, supplier_company,
      product_id, unit_cost, source, paid_amount, outstanding_amount, created_by
    )
    values (
      target_workspace_id, 'purchase', new_invoice_number, product_name, new_vendor_name,
      stock_increase, purchase_total, 'Recorded', current_date, supplier_id, supplier_contact,
      supplier_company, target_product_id, product_cost, 'supplier', 0, purchase_total, auth.uid()
    )
    returning id into new_transaction_id;

    insert into public.purchase_items (
      workspace_id, transaction_id, line_number, product_id, name_snapshot, quantity, unit_cost, amount
    ) values (
      target_workspace_id, new_transaction_id, 1, target_product_id, product_name,
      stock_increase, product_cost, purchase_total
    );

    insert into public.stock_movements (
      workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
    ) values (
      target_workspace_id, target_product_id, new_transaction_id, 'purchase', stock_increase, product_cost, current_date
    );
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'update', 'product', target_product_id, product_payload);

  return target_product_id;
end;
$$;

create or replace function public.delete_product(
  target_workspace_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) <> 'owner' then
    raise exception 'Owner access is required to delete inventory';
  end if;
  if not exists (select 1 from public.products where id = target_product_id and workspace_id = target_workspace_id) then
    raise exception 'Product not found';
  end if;
  if exists (select 1 from public.sale_items where product_id = target_product_id and workspace_id = target_workspace_id)
     or exists (select 1 from public.purchase_items where product_id = target_product_id and workspace_id = target_workspace_id)
     or exists (select 1 from public.stock_movements where product_id = target_product_id and workspace_id = target_workspace_id) then
    raise exception 'Products with transaction history cannot be deleted';
  end if;

  delete from public.products
  where id = target_product_id and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id)
  values (target_workspace_id, auth.uid(), 'delete', 'product', target_product_id);
end;
$$;

revoke all on function public.create_product(uuid, jsonb) from public;
revoke all on function public.update_product(uuid, uuid, jsonb) from public;
revoke all on function public.delete_product(uuid, uuid) from public;
grant execute on function public.create_product(uuid, jsonb) to authenticated;
grant execute on function public.update_product(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_product(uuid, uuid) to authenticated;
