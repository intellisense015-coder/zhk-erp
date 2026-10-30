-- Secure capital and supplier-payment operations.
-- Balance checks run inside locked transactions to prevent concurrent overspending.

create or replace function public.create_capital_account(
  target_workspace_id uuid,
  capital_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid;
  capital_name text := nullif(trim(coalesce(capital_payload->>'name', '')), '');
  owner_name text := trim(coalesce(capital_payload->>'owner_name', ''));
  opening_amount numeric := coalesce(nullif(capital_payload->>'amount', '')::numeric, 0);
  entry_note text := nullif(trim(coalesce(capital_payload->>'note', '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to create capital accounts'; end if;
  if capital_name is null or length(capital_name) > 120 then raise exception 'Enter a valid capital account name'; end if;
  if length(owner_name) > 120 then raise exception 'Capital owner name is invalid'; end if;
  if opening_amount <= 0 or opening_amount > 999999999999.99 then raise exception 'Opening capital must be greater than zero'; end if;
  if entry_note is not null and length(entry_note) > 500 then raise exception 'Capital note is too long'; end if;
  if exists (select 1 from public.capital_accounts where workspace_id = target_workspace_id and lower(name) = lower(capital_name)) then raise exception 'A capital account with this name already exists'; end if;

  insert into public.capital_accounts (workspace_id, name, owner_name)
  values (target_workspace_id, capital_name, owner_name)
  returning id into account_id;
  insert into public.capital_entries (workspace_id, capital_id, entry_type, amount, occurred_on, note)
  values (target_workspace_id, account_id, 'contribution', opening_amount, (now() at time zone 'Asia/Karachi')::date, entry_note);
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'capital_account', account_id, jsonb_build_object('name', capital_name, 'opening_amount', opening_amount));
  return account_id;
end;
$$;

create or replace function public.create_capital_entry(
  target_workspace_id uuid,
  capital_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
  requested_capital_id uuid := nullif(capital_payload->>'capital_id', '')::uuid;
  entry_type text := lower(trim(coalesce(capital_payload->>'type', '')));
  entry_amount numeric := coalesce(nullif(capital_payload->>'amount', '')::numeric, 0);
  entry_note text := nullif(trim(coalesce(capital_payload->>'note', '')), '');
  contributed numeric;
  withdrawn numeric;
  purchase_usage numeric;
  payment_usage numeric;
  available numeric;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to record capital movements'; end if;
  if requested_capital_id is null or entry_type not in ('contribution', 'withdrawal') or entry_amount <= 0 or entry_amount > 999999999999.99 then raise exception 'Capital movement details are invalid'; end if;
  if entry_note is not null and length(entry_note) > 500 then raise exception 'Capital note is too long'; end if;

  perform 1 from public.capital_accounts where id = requested_capital_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'Capital account not found'; end if;

  select coalesce(sum(ce.amount) filter (where ce.entry_type = 'contribution'), 0),
         coalesce(sum(ce.amount) filter (where ce.entry_type = 'withdrawal'), 0)
    into contributed, withdrawn
    from public.capital_entries ce
   where ce.workspace_id = target_workspace_id and ce.capital_id = requested_capital_id;
  select coalesce(sum(paid_amount), 0) into purchase_usage
    from public.transactions
   where workspace_id = target_workspace_id and transaction_type = 'purchase' and capital_id = requested_capital_id;
  select coalesce(sum(amount), 0) into payment_usage
    from public.supplier_payments
   where workspace_id = target_workspace_id and capital_id = requested_capital_id and coalesce(note, '') <> 'Paid with purchase';
  available := contributed - withdrawn - purchase_usage - payment_usage;
  if entry_type = 'withdrawal' and entry_amount > available then raise exception 'The withdrawal exceeds the available capital'; end if;

  insert into public.capital_entries (workspace_id, capital_id, entry_type, amount, occurred_on, note)
  values (target_workspace_id, requested_capital_id, entry_type, entry_amount, (now() at time zone 'Asia/Karachi')::date, entry_note)
  returning id into entry_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'capital_entry', entry_id, jsonb_build_object('capital_id', requested_capital_id, 'type', entry_type, 'amount', entry_amount));
  return entry_id;
end;
$$;

create or replace function public.record_supplier_payment(
  target_workspace_id uuid,
  payment_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_id uuid;
  requested_supplier_id uuid := nullif(payment_payload->>'supplier_id', '')::uuid;
  requested_capital_id uuid := nullif(payment_payload->>'capital_id', '')::uuid;
  payment_amount numeric := coalesce(nullif(payment_payload->>'amount', '')::numeric, 0);
  payment_note text := nullif(trim(coalesce(payment_payload->>'note', '')), '');
  supplier_row public.suppliers%rowtype;
  purchased numeric;
  paid numeric;
  outstanding numeric;
  contributed numeric;
  withdrawn numeric;
  purchase_usage numeric;
  payment_usage numeric;
  capital_available numeric;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Not authorized for this workspace'; end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then raise exception 'Manager access is required to record supplier payments'; end if;
  if requested_supplier_id is null or payment_amount <= 0 or payment_amount > 999999999999.99 then raise exception 'Supplier payment details are invalid'; end if;
  if payment_note is not null and length(payment_note) > 500 then raise exception 'Payment note is too long'; end if;

  select * into supplier_row from public.suppliers where id = requested_supplier_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'Supplier record not found'; end if;
  select coalesce(sum(amount), 0) into purchased
    from public.transactions
   where workspace_id = target_workspace_id and transaction_type = 'purchase' and supplier_id = requested_supplier_id;
  select coalesce(sum(amount), 0) into paid
    from public.supplier_payments
   where workspace_id = target_workspace_id and supplier_id = requested_supplier_id;
  outstanding := purchased + supplier_row.opening_balance - paid;
  if payment_amount > outstanding then raise exception 'Payment cannot exceed the supplier''s outstanding balance'; end if;

  if requested_capital_id is not null then
    perform 1 from public.capital_accounts where id = requested_capital_id and workspace_id = target_workspace_id for update;
    if not found then raise exception 'Capital account not found'; end if;
    select coalesce(sum(ce.amount) filter (where ce.entry_type = 'contribution'), 0),
           coalesce(sum(ce.amount) filter (where ce.entry_type = 'withdrawal'), 0)
      into contributed, withdrawn
      from public.capital_entries
     where workspace_id = target_workspace_id and capital_id = requested_capital_id;
    select coalesce(sum(paid_amount), 0) into purchase_usage
      from public.transactions
     where workspace_id = target_workspace_id and transaction_type = 'purchase' and capital_id = requested_capital_id;
    select coalesce(sum(amount), 0) into payment_usage
      from public.supplier_payments
     where workspace_id = target_workspace_id and capital_id = requested_capital_id and coalesce(note, '') <> 'Paid with purchase';
    capital_available := contributed - withdrawn - purchase_usage - payment_usage;
    if payment_amount > capital_available then raise exception 'The supplier payment exceeds the available capital'; end if;
  end if;

  insert into public.supplier_payments (workspace_id, supplier_id, amount, note, occurred_on, capital_id)
  values (target_workspace_id, requested_supplier_id, payment_amount, payment_note, (now() at time zone 'Asia/Karachi')::date, requested_capital_id)
  returning id into payment_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'supplier_payment', payment_id, jsonb_build_object('supplier_id', requested_supplier_id, 'amount', payment_amount, 'capital_id', requested_capital_id));
  return payment_id;
end;
$$;

revoke all on function public.create_capital_account(uuid, jsonb) from public;
revoke all on function public.create_capital_entry(uuid, jsonb) from public;
revoke all on function public.record_supplier_payment(uuid, jsonb) from public;
grant execute on function public.create_capital_account(uuid, jsonb) to authenticated;
grant execute on function public.create_capital_entry(uuid, jsonb) to authenticated;
grant execute on function public.record_supplier_payment(uuid, jsonb) to authenticated;
