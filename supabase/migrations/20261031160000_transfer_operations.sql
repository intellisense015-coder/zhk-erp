-- Secure transfer recording.
-- Transfers are an intra-business movement record between named entities. The
-- current schema has one workspace-wide stock balance and no per-entity stock
-- ledger, so this operation records the transfer and audit entry without
-- changing total product stock.

create or replace function public.record_transfer(
  target_workspace_id uuid,
  transfer_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_product_id_text text := nullif(trim(coalesce(transfer_payload->>'product_id', '')), '');
  requested_transfer_kind text := lower(trim(coalesce(transfer_payload->>'transfer_kind', '')));
  requested_from_entity text := nullif(trim(coalesce(transfer_payload->>'from_entity', '')), '');
  requested_to_entity text := nullif(trim(coalesce(transfer_payload->>'to_entity', '')), '');
  requested_quantity_text text := trim(coalesce(transfer_payload->>'quantity', ''));
  requested_amount_text text := trim(coalesce(transfer_payload->>'amount', '0'));
  requested_product_id uuid;
  requested_quantity integer;
  requested_amount numeric;
  transfer_id uuid;
  transfer_date date := (now() at time zone 'Asia/Karachi')::date;
  time_label text := to_char(now() at time zone 'Asia/Karachi', 'HH12:MI AM');
  product_row public.products%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to record transfers';
  end if;

  if requested_product_id_text is null
     or requested_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'The transfer product is invalid';
  end if;
  if requested_transfer_kind not in ('supplier-to-customer', 'customer-to-customer') then
    raise exception 'The transfer type is invalid';
  end if;
  if requested_from_entity is null or length(requested_from_entity) > 200
     or requested_to_entity is null or length(requested_to_entity) > 200 then
    raise exception 'Transfer entities are required and must be 200 characters or less';
  end if;
  if lower(requested_from_entity) = lower(requested_to_entity) then
    raise exception 'Choose two different entities';
  end if;
  if requested_quantity_text !~ '^[0-9]+$' or length(requested_quantity_text) > 10 then
    raise exception 'Transfer quantity must be a whole number';
  end if;
  if requested_quantity_text::numeric > 2147483647 then
    raise exception 'Transfer quantity is beyond the supported limit';
  end if;
  if requested_amount_text !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception 'Transfer amount must be a valid non-negative number';
  end if;

  requested_product_id := requested_product_id_text::uuid;
  requested_quantity := requested_quantity_text::integer;
  requested_amount := round(requested_amount_text::numeric, 2);

  if requested_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero';
  end if;
  if requested_amount > 999999999999.99 then
    raise exception 'Transfer amount is beyond the supported limit';
  end if;

  select * into product_row
  from public.products
  where id = requested_product_id
    and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'Product not found in this workspace';
  end if;
  if requested_quantity > product_row.stock_quantity then
    raise exception '% only has % units available', product_row.name, product_row.stock_quantity;
  end if;

  insert into public.transactions (
    workspace_id,
    transaction_type,
    name,
    party,
    quantity,
    amount,
    time_label,
    occurred_on,
    from_entity,
    to_entity,
    transfer_kind,
    product_id,
    unit_cost,
    created_by
  )
  values (
    target_workspace_id,
    'transfer',
    product_row.name,
    requested_from_entity || ' → ' || requested_to_entity,
    requested_quantity,
    requested_amount,
    time_label,
    transfer_date,
    requested_from_entity,
    requested_to_entity,
    requested_transfer_kind,
    requested_product_id,
    product_row.cost_price,
    auth.uid()
  )
  returning id into transfer_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'create',
    'transfer',
    transfer_id,
    jsonb_build_object(
      'product_id', requested_product_id,
      'quantity', requested_quantity,
      'amount', requested_amount,
      'from_entity', requested_from_entity,
      'to_entity', requested_to_entity,
      'transfer_kind', requested_transfer_kind
    )
  );

  return transfer_id;
end;
$$;

revoke all on function public.record_transfer(uuid, jsonb) from public, anon;
grant execute on function public.record_transfer(uuid, jsonb) to authenticated;
