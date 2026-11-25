-- Allow managers to correct capital account metadata and movement entries while
-- preserving the same balance checks used when recording new movements.

create or replace function public.update_capital_account(
  target_workspace_id uuid,
  target_capital_id uuid,
  capital_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_name text := nullif(trim(coalesce(capital_payload->>'name', '')), '');
  requested_owner_name text := trim(coalesce(capital_payload->>'owner_name', ''));
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to edit capital accounts'; end if;
  if account_name is null or length(account_name) > 120 then raise exception 'Enter a valid capital account name'; end if;
  if length(requested_owner_name) > 120 then raise exception 'Capital owner name is invalid'; end if;

  perform 1
  from public.capital_accounts
  where id = target_capital_id
    and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'Capital account not found'; end if;
  if exists (
    select 1 from public.capital_accounts
    where workspace_id = target_workspace_id
      and id <> target_capital_id
      and lower(name) = lower(account_name)
  ) then
    raise exception 'A capital account with this name already exists';
  end if;

  update public.capital_accounts
  set name = account_name,
      owner_name = requested_owner_name,
      updated_at = now()
  where id = target_capital_id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'update', 'capital_account', target_capital_id, jsonb_build_object('name', account_name, 'owner_name', requested_owner_name));
  return target_capital_id;
end;
$$;

create or replace function public.update_capital_entry(
  target_workspace_id uuid,
  target_entry_id uuid,
  capital_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_entry public.capital_entries%rowtype;
  requested_capital_id uuid := nullif(capital_payload->>'capital_id', '')::uuid;
  requested_type text := lower(trim(coalesce(capital_payload->>'type', '')));
  requested_amount numeric := coalesce(nullif(capital_payload->>'amount', '')::numeric, 0);
  requested_note text := nullif(trim(coalesce(capital_payload->>'note', '')), '');
  available numeric;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to edit capital movements'; end if;
  if requested_capital_id is null or requested_type not in ('contribution', 'withdrawal') or requested_amount <= 0 or requested_amount > 999999999999.99 then raise exception 'Capital movement details are invalid'; end if;
  if requested_note is not null and length(requested_note) > 500 then raise exception 'Capital note is too long'; end if;

  select * into existing_entry
  from public.capital_entries
  where id = target_entry_id
    and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'Capital movement not found'; end if;

  perform 1
  from public.capital_accounts
  where id = requested_capital_id
    and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'Capital account not found'; end if;

  available := public.capital_available(target_workspace_id, requested_capital_id);
  if existing_entry.capital_id = requested_capital_id then
    if existing_entry.entry_type = 'contribution' then
      available := available - existing_entry.amount;
    else
      available := available + existing_entry.amount;
    end if;
  end if;
  if requested_type = 'withdrawal' and requested_amount > available then
    raise exception using message = format(
      'The withdrawal cannot be completed due to insufficient capital. Available capital: %s; withdrawal amount: %s.',
      to_char(available, 'FM999999999999990.00'),
      to_char(round(requested_amount, 2), 'FM999999999999990.00')
    );
  end if;

  update public.capital_entries
  set capital_id = requested_capital_id,
      entry_type = requested_type,
      amount = round(requested_amount, 2),
      note = requested_note
  where id = target_entry_id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'capital_entry',
    target_entry_id,
    jsonb_build_object('capital_id', requested_capital_id, 'type', requested_type, 'amount', round(requested_amount, 2), 'note', requested_note)
  );
  return target_entry_id;
end;
$$;

revoke all on function public.update_capital_account(uuid, uuid, jsonb) from public, anon;
revoke all on function public.update_capital_entry(uuid, uuid, jsonb) from public, anon;
grant execute on function public.update_capital_account(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_capital_entry(uuid, uuid, jsonb) to authenticated;
