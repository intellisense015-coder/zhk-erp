-- Extend capital-account editing to correct the opening contribution amount.
-- Later contributions and withdrawals remain separate movement history.

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
  requested_opening_amount numeric := coalesce(nullif(capital_payload->>'opening_amount', '')::numeric, 0);
  opening_entry_id uuid;
  current_opening_amount numeric := 0;
  current_available numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to edit capital accounts'; end if;
  if account_name is null or length(account_name) > 120 then raise exception 'Enter a valid capital account name'; end if;
  if length(requested_owner_name) > 120 then raise exception 'Capital owner name is invalid'; end if;
  if requested_opening_amount <= 0 or requested_opening_amount > 999999999999.99 then raise exception 'Opening capital amount must be greater than zero and within the supported limit'; end if;

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

  select id, amount into opening_entry_id, current_opening_amount
  from public.capital_entries
  where workspace_id = target_workspace_id
    and capital_id = target_capital_id
    and entry_type = 'contribution'
  order by created_at asc, id asc
  limit 1
  for update;

  current_available := public.capital_available(target_workspace_id, target_capital_id);
  if round(current_available - current_opening_amount + requested_opening_amount, 2) < 0 then
    raise exception using message = format(
      'The opening amount cannot be reduced this far because it would make available capital negative. Available capital after edit: %s.',
      to_char(round(current_available - current_opening_amount + requested_opening_amount, 2), 'FM999999999999990.00')
    );
  end if;

  if opening_entry_id is null then
    insert into public.capital_entries (workspace_id, capital_id, entry_type, amount, occurred_on, note)
    values (target_workspace_id, target_capital_id, 'contribution', round(requested_opening_amount, 2), current_date, 'Opening capital');
  else
    update public.capital_entries
    set amount = round(requested_opening_amount, 2)
    where id = opening_entry_id
      and workspace_id = target_workspace_id;
  end if;

  update public.capital_accounts
  set name = account_name,
      owner_name = requested_owner_name,
      updated_at = now()
  where id = target_capital_id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'update', 'capital_account', target_capital_id,
    jsonb_build_object('name', account_name, 'owner_name', requested_owner_name, 'opening_amount', round(requested_opening_amount, 2)));
  return target_capital_id;
end;
$$;

revoke all on function public.update_capital_account(uuid, uuid, jsonb) from public, anon;
grant execute on function public.update_capital_account(uuid, uuid, jsonb) to authenticated;
