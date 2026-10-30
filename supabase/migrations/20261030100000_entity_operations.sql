-- Secure customer and supplier entity operations.

create or replace function public.create_customer(
  target_workspace_id uuid,
  customer_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_id uuid;
  customer_name text := nullif(trim(coalesce(customer_payload->>'name', '')), '');
  customer_contact text := regexp_replace(trim(coalesce(customer_payload->>'contact_number', '')), '[^0-9]', '', 'g');
  customer_gender text := trim(coalesce(customer_payload->>'gender', ''));
  customer_cnic text := regexp_replace(trim(coalesce(customer_payload->>'cnic_number', '')), '[^0-9]', '', 'g');
  customer_code text;
  owner_contact text;
  code_index integer := 1;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if customer_name is null or length(customer_name) > 160 then raise exception 'Enter a valid customer name'; end if;
  if customer_contact !~ '^[0-9]{7,15}$' then raise exception 'Customer contact number is invalid'; end if;
  if customer_gender <> '' and length(customer_gender) > 40 then raise exception 'Customer gender is invalid'; end if;
  if customer_cnic <> '' and length(customer_cnic) <> 13 then raise exception 'CNIC number is invalid'; end if;
  select regexp_replace(owner_contact_number, '[^0-9]', '', 'g') into owner_contact from public.workspaces where id = target_workspace_id;
  if owner_contact is null then raise exception 'Workspace was not found'; end if;
  if owner_contact <> '' and owner_contact = customer_contact then raise exception 'The business owner contact cannot be used as a customer contact'; end if;
  if exists (select 1 from public.customers where workspace_id = target_workspace_id and contact_number = customer_contact) then raise exception 'This contact number is already assigned to another customer'; end if;
  if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = customer_contact) then raise exception 'This contact number belongs to a supplier and cannot be reused for a customer'; end if;

  loop
    customer_code := 'CUST-' || lpad(code_index::text, 3, '0');
    exit when not exists (select 1 from public.customers where workspace_id = target_workspace_id and code = customer_code);
    code_index := code_index + 1;
  end loop;

  insert into public.customers (workspace_id, name, contact_number, gender, cnic_number, code)
  values (target_workspace_id, customer_name, customer_contact, customer_gender, customer_cnic, customer_code)
  returning id into customer_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'customer', customer_id, jsonb_build_object('name', customer_name, 'contact_number', customer_contact, 'code', customer_code));
  return customer_id;
end;
$$;

create or replace function public.update_customer(
  target_workspace_id uuid,
  target_customer_id uuid,
  customer_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text := nullif(trim(coalesce(customer_payload->>'name', '')), '');
  customer_contact text := regexp_replace(trim(coalesce(customer_payload->>'contact_number', '')), '[^0-9]', '', 'g');
  customer_gender text := trim(coalesce(customer_payload->>'gender', ''));
  customer_cnic text := regexp_replace(trim(coalesce(customer_payload->>'cnic_number', '')), '[^0-9]', '', 'g');
  owner_contact text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to edit customers'; end if;
  if not exists (select 1 from public.customers where id = target_customer_id and workspace_id = target_workspace_id) then raise exception 'Customer record not found'; end if;
  if customer_name is null or length(customer_name) > 160 then raise exception 'Enter a valid customer name'; end if;
  if customer_contact !~ '^[0-9]{7,15}$' then raise exception 'Customer contact number is invalid'; end if;
  if customer_gender <> '' and length(customer_gender) > 40 then raise exception 'Customer gender is invalid'; end if;
  if customer_cnic <> '' and length(customer_cnic) <> 13 then raise exception 'CNIC number is invalid'; end if;
  select regexp_replace(owner_contact_number, '[^0-9]', '', 'g') into owner_contact from public.workspaces where id = target_workspace_id;
  if owner_contact is null then raise exception 'Workspace was not found'; end if;
  if owner_contact <> '' and owner_contact = customer_contact then raise exception 'The business owner contact cannot be used as a customer contact'; end if;
  if exists (select 1 from public.customers where workspace_id = target_workspace_id and contact_number = customer_contact and id <> target_customer_id) then raise exception 'This contact number is already assigned to another customer'; end if;
  if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = customer_contact) then raise exception 'This contact number belongs to a supplier and cannot be reused for a customer'; end if;

  update public.customers
     set name = customer_name, contact_number = customer_contact, gender = customer_gender,
         cnic_number = customer_cnic, updated_at = now()
   where id = target_customer_id and workspace_id = target_workspace_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'update', 'customer', target_customer_id, jsonb_build_object('name', customer_name, 'contact_number', customer_contact));
end;
$$;

create or replace function public.delete_customer(target_workspace_id uuid, target_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare deleted_name text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) <> 'owner' then raise exception 'Owner access is required to delete customers'; end if;
  select name into deleted_name from public.customers where id = target_customer_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'Customer record not found'; end if;
  delete from public.customers where id = target_customer_id and workspace_id = target_workspace_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'delete', 'customer', target_customer_id, jsonb_build_object('name', deleted_name));
end;
$$;

create or replace function public.create_supplier(
  target_workspace_id uuid,
  supplier_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_id uuid;
  supplier_name text := nullif(trim(coalesce(supplier_payload->>'name', '')), '');
  supplier_contact text := regexp_replace(trim(coalesce(supplier_payload->>'contact_number', '')), '[^0-9]', '', 'g');
  supplier_company text := trim(coalesce(supplier_payload->>'company', ''));
  supplier_cnic text := regexp_replace(trim(coalesce(supplier_payload->>'cnic_number', '')), '[^0-9]', '', 'g');
  supplier_opening numeric := coalesce(nullif(supplier_payload->>'opening_balance', '')::numeric, 0);
  owner_contact text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to create suppliers'; end if;
  if supplier_name is null or length(supplier_name) > 160 then raise exception 'Enter a valid supplier name'; end if;
  if supplier_contact !~ '^[0-9]{7,15}$' then raise exception 'Supplier contact number is invalid'; end if;
  if length(supplier_company) > 160 then raise exception 'Supplier company is invalid'; end if;
  if supplier_cnic <> '' and length(supplier_cnic) <> 13 then raise exception 'CNIC number is invalid'; end if;
  if supplier_opening < 0 or supplier_opening > 999999999999.99 then raise exception 'Opening balance is invalid'; end if;
  select regexp_replace(owner_contact_number, '[^0-9]', '', 'g') into owner_contact from public.workspaces where id = target_workspace_id;
  if owner_contact is null then raise exception 'Workspace was not found'; end if;
  if owner_contact <> '' and owner_contact = supplier_contact then raise exception 'The business owner contact cannot be used as a supplier contact'; end if;
  if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = supplier_contact) then raise exception 'This supplier contact number is already assigned to another supplier'; end if;
  if exists (select 1 from public.customers where workspace_id = target_workspace_id and contact_number = supplier_contact) then raise exception 'This contact number belongs to a customer and cannot be reused for a supplier'; end if;

  insert into public.suppliers (workspace_id, name, contact_number, company, cnic_number, opening_balance)
  values (target_workspace_id, supplier_name, supplier_contact, supplier_company, supplier_cnic, supplier_opening)
  returning id into supplier_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'supplier', supplier_id, jsonb_build_object('name', supplier_name, 'contact_number', supplier_contact, 'opening_balance', supplier_opening));
  return supplier_id;
end;
$$;

create or replace function public.update_supplier(
  target_workspace_id uuid,
  target_supplier_id uuid,
  supplier_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_name text := nullif(trim(coalesce(supplier_payload->>'name', '')), '');
  supplier_contact text := regexp_replace(trim(coalesce(supplier_payload->>'contact_number', '')), '[^0-9]', '', 'g');
  supplier_company text := trim(coalesce(supplier_payload->>'company', ''));
  supplier_cnic text := regexp_replace(trim(coalesce(supplier_payload->>'cnic_number', '')), '[^0-9]', '', 'g');
  supplier_opening numeric := coalesce(nullif(supplier_payload->>'opening_balance', '')::numeric, 0);
  owner_contact text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to edit suppliers'; end if;
  if not exists (select 1 from public.suppliers where id = target_supplier_id and workspace_id = target_workspace_id) then raise exception 'Supplier record not found'; end if;
  if supplier_name is null or length(supplier_name) > 160 then raise exception 'Enter a valid supplier name'; end if;
  if supplier_contact !~ '^[0-9]{7,15}$' then raise exception 'Supplier contact number is invalid'; end if;
  if length(supplier_company) > 160 then raise exception 'Supplier company is invalid'; end if;
  if supplier_cnic <> '' and length(supplier_cnic) <> 13 then raise exception 'CNIC number is invalid'; end if;
  if supplier_opening < 0 or supplier_opening > 999999999999.99 then raise exception 'Opening balance is invalid'; end if;
  select regexp_replace(owner_contact_number, '[^0-9]', '', 'g') into owner_contact from public.workspaces where id = target_workspace_id;
  if owner_contact is null then raise exception 'Workspace was not found'; end if;
  if owner_contact <> '' and owner_contact = supplier_contact then raise exception 'The business owner contact cannot be used as a supplier contact'; end if;
  if exists (select 1 from public.suppliers where workspace_id = target_workspace_id and contact_number = supplier_contact and id <> target_supplier_id) then raise exception 'This supplier contact number is already assigned to another supplier'; end if;
  if exists (select 1 from public.customers where workspace_id = target_workspace_id and contact_number = supplier_contact) then raise exception 'This contact number belongs to a customer and cannot be reused for a supplier'; end if;

  update public.suppliers
     set name = supplier_name, contact_number = supplier_contact, company = supplier_company,
         cnic_number = supplier_cnic, opening_balance = supplier_opening, updated_at = now()
   where id = target_supplier_id and workspace_id = target_workspace_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'update', 'supplier', target_supplier_id, jsonb_build_object('name', supplier_name, 'contact_number', supplier_contact, 'opening_balance', supplier_opening));
end;
$$;

create or replace function public.delete_supplier(target_workspace_id uuid, target_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare deleted_name text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) <> 'owner' then raise exception 'Owner access is required to delete suppliers'; end if;
  select name into deleted_name from public.suppliers where id = target_supplier_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'Supplier record not found'; end if;
  delete from public.suppliers where id = target_supplier_id and workspace_id = target_workspace_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'delete', 'supplier', target_supplier_id, jsonb_build_object('name', deleted_name));
end;
$$;

revoke all on function public.create_customer(uuid, jsonb) from public;
revoke all on function public.update_customer(uuid, uuid, jsonb) from public;
revoke all on function public.delete_customer(uuid, uuid) from public;
revoke all on function public.create_supplier(uuid, jsonb) from public;
revoke all on function public.update_supplier(uuid, uuid, jsonb) from public;
revoke all on function public.delete_supplier(uuid, uuid) from public;
grant execute on function public.create_customer(uuid, jsonb) to authenticated;
grant execute on function public.update_customer(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_customer(uuid, uuid) to authenticated;
grant execute on function public.create_supplier(uuid, jsonb) to authenticated;
grant execute on function public.update_supplier(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_supplier(uuid, uuid) to authenticated;
