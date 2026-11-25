-- Create a product and, when requested, record its opening stock as a
-- capital-backed supplier purchase in the same transaction.

create or replace function public.create_product_with_capital(
  target_workspace_id uuid,
  product_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  stock_quantity integer := coalesce(nullif(product_payload->>'in_stock_quantity', '')::integer, 0);
  requested_capital_id uuid := nullif(product_payload->>'capital_id', '')::uuid;
  normalized_supplier_contact text := regexp_replace(trim(coalesce(product_payload->>'vendor_contact_number', '')), '[^0-9]', '', 'g');
  supplier_id uuid;
  product_id uuid;
  zero_stock_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required for inventory changes'; end if;
  if stock_quantity < 0 then raise exception 'Stock quantity cannot be negative'; end if;
  if stock_quantity > 0 and requested_capital_id is null then raise exception 'Select a capital account for the opening stock'; end if;

  zero_stock_payload := jsonb_set(product_payload, '{in_stock_quantity}', to_jsonb(0), true);
  product_id := public.create_product(target_workspace_id, zero_stock_payload);

  if stock_quantity = 0 then
    return product_id;
  end if;

  select id into supplier_id
  from public.suppliers
  where workspace_id = target_workspace_id
    and lower(name) = lower(trim(coalesce(product_payload->>'vendor_name', '')))
    and contact_number = normalized_supplier_contact
  order by created_at desc
  limit 1;
  if supplier_id is null then raise exception 'The supplier attached to this product could not be resolved'; end if;

  perform public.record_purchase(
    target_workspace_id,
    jsonb_build_object(
      'product_id', product_id,
      'supplier_id', supplier_id,
      'vendor_name', trim(coalesce(product_payload->>'vendor_name', '')),
      'supplier_contact_number', normalized_supplier_contact,
      'supplier_company', trim(coalesce(product_payload->>'vendor_company', '')),
      'quantity', stock_quantity,
      'unit_cost', coalesce(nullif(product_payload->>'cost_price', '')::numeric, 0),
      'paid_amount', 0,
      'funding_source', 'capital',
      'capital_id', requested_capital_id
    )
  );

  return product_id;
end;
$$;

revoke all on function public.create_product_with_capital(uuid, jsonb) from public, anon;
grant execute on function public.create_product_with_capital(uuid, jsonb) to authenticated;
