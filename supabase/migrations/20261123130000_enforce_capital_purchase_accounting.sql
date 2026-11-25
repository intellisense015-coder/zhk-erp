-- Enforce capital-funded inventory accounting at the database boundary.
-- A purchase reserves its full amount from capital. A supplier payment linked
-- to that purchase is only a settlement record and is not charged twice.

create or replace function public.capital_available(
  target_workspace_id uuid,
  target_capital_id uuid,
  excluded_purchase_id uuid default null
)
returns numeric
language sql
security definer
set search_path = public
as $$
  select round(
    coalesce((
      select sum(case when entry_type = 'contribution' then amount else -amount end)
      from public.capital_entries
      where workspace_id = target_workspace_id
        and capital_id = target_capital_id
    ), 0)
    - coalesce((
      select sum(amount)
      from public.transactions
      where workspace_id = target_workspace_id
        and transaction_type = 'purchase'
        and source = 'supplier'
        and capital_id = target_capital_id
        and id is distinct from excluded_purchase_id
    ), 0)
    - coalesce((
      select sum(amount)
      from public.supplier_payments
      where workspace_id = target_workspace_id
        and capital_id = target_capital_id
        and purchase_transaction_id is null
        and coalesce(note, '') not in ('Paid with purchase', 'Paid with exchange arrangement')
    ), 0),
    2
  );
$$;

revoke all on function public.capital_available(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.enforce_capital_purchase_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
begin
  if new.transaction_type <> 'purchase' or new.source <> 'supplier' then
    return new;
  end if;

  if new.capital_id is null or new.funding_source <> 'capital' then
    raise exception 'Every supplier stock purchase must use a capital account';
  end if;

  perform 1
  from public.capital_accounts
  where id = new.capital_id
    and workspace_id = new.workspace_id
  for update;
  if not found then
    raise exception 'The selected capital account no longer exists';
  end if;

  available := public.capital_available(
    new.workspace_id,
    new.capital_id,
    case when tg_op = 'UPDATE' then old.id else null end
  );

  if round(new.amount, 2) > available then
    raise exception using message = format(
      'The purchase cannot be completed due to insufficient capital. Available capital: %s; purchase total: %s.',
      to_char(available, 'FM999999999999990.00'),
      to_char(round(new.amount, 2), 'FM999999999999990.00')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_enforce_capital_purchase_balance on public.transactions;
create trigger transactions_enforce_capital_purchase_balance
before insert or update of amount, capital_id, funding_source, transaction_type, source
on public.transactions
for each row execute function public.enforce_capital_purchase_balance();

create or replace function public.enforce_capital_supplier_payment_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
begin
  if new.capital_id is null or new.purchase_transaction_id is not null then
    return new;
  end if;

  perform 1
  from public.capital_accounts
  where id = new.capital_id
    and workspace_id = new.workspace_id
  for update;
  if not found then
    raise exception 'The selected capital account no longer exists';
  end if;

  if exists (
    select 1
    from public.transactions
    where workspace_id = new.workspace_id
      and transaction_type = 'purchase'
      and source = 'supplier'
      and supplier_id = new.supplier_id
      and coalesce(outstanding_amount, 0) > 0
      and id is distinct from new.purchase_transaction_id
  ) then
    raise exception 'This supplier balance is already reserved against capital-funded stock. Settle it with other funds.';
  end if;

  available := public.capital_available(new.workspace_id, new.capital_id);
  if tg_op = 'UPDATE'
     and old.capital_id = new.capital_id
     and old.purchase_transaction_id is null then
    available := available + old.amount;
  end if;

  if round(new.amount, 2) > available then
    raise exception using message = format(
      'The supplier payment cannot be completed due to insufficient capital. Available capital: %s; payment amount: %s.',
      to_char(available, 'FM999999999999990.00'),
      to_char(round(new.amount, 2), 'FM999999999999990.00')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_payments_enforce_capital_balance on public.supplier_payments;
create trigger supplier_payments_enforce_capital_balance
before insert or update of amount, capital_id, purchase_transaction_id
on public.supplier_payments
for each row execute function public.enforce_capital_supplier_payment_balance();

create or replace function public.enforce_capital_withdrawal_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
begin
  if new.entry_type <> 'withdrawal' then
    return new;
  end if;

  perform 1
  from public.capital_accounts
  where id = new.capital_id
    and workspace_id = new.workspace_id
  for update;
  if not found then
    raise exception 'The selected capital account no longer exists';
  end if;

  available := public.capital_available(new.workspace_id, new.capital_id);
  if tg_op = 'UPDATE' and old.capital_id = new.capital_id then
    if old.entry_type = 'contribution' then
      available := available - old.amount;
    else
      available := available + old.amount;
    end if;
  end if;

  if round(new.amount, 2) > available then
    raise exception using message = format(
      'The withdrawal cannot be completed due to insufficient capital. Available capital: %s; withdrawal amount: %s.',
      to_char(available, 'FM999999999999990.00'),
      to_char(round(new.amount, 2), 'FM999999999999990.00')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists capital_entries_enforce_withdrawal_balance on public.capital_entries;
create trigger capital_entries_enforce_withdrawal_balance
before insert or update of amount, capital_id, entry_type
on public.capital_entries
for each row execute function public.enforce_capital_withdrawal_balance();

revoke all on function public.enforce_capital_purchase_balance() from public, anon, authenticated;
revoke all on function public.enforce_capital_supplier_payment_balance() from public, anon, authenticated;
revoke all on function public.enforce_capital_withdrawal_balance() from public, anon, authenticated;

create or replace function public.cancel_purchase(
  target_workspace_id uuid,
  target_purchase_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_row public.transactions%rowtype;
  purchase_item_row public.purchase_items%rowtype;
  product_row public.products%rowtype;
  supplier_row public.suppliers%rowtype;
  purchased_for_supplier numeric;
  non_linked_paid numeric;
  purchase_quantity integer;
  movement_quantity integer;
  movement_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to cancel purchases';
  end if;

  select * into purchase_row
  from public.transactions
  where id = target_purchase_id
    and workspace_id = target_workspace_id
    and transaction_type = 'purchase'
    and source = 'supplier'
  for update;
  if not found then
    raise exception 'Supplier purchase record not found';
  end if;

  select count(*), coalesce(sum(quantity_delta), 0)
    into movement_count, movement_quantity
  from public.stock_movements
  where workspace_id = target_workspace_id
    and transaction_id = target_purchase_id
    and movement_type = 'purchase';

  select * into purchase_item_row
  from public.purchase_items
  where workspace_id = target_workspace_id
    and transaction_id = target_purchase_id
  order by line_number
  limit 1
  for update;
  if not found or purchase_item_row.product_id is distinct from purchase_row.product_id then
    raise exception 'This purchase does not have a consistent item record';
  end if;

  purchase_quantity := purchase_item_row.quantity;
  if movement_count <> 1 or movement_quantity <> purchase_quantity then
    raise exception 'This purchase does not have a consistent stock movement record';
  end if;

  select * into product_row
  from public.products
  where id = purchase_item_row.product_id
    and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'The product attached to this purchase no longer exists';
  end if;
  if product_row.stock_quantity < purchase_quantity
     or product_row.received_quantity < purchase_quantity then
    raise exception 'This purchase cannot be cancelled because the stock has already been consumed';
  end if;

  if purchase_row.supplier_id is not null then
    select * into supplier_row
    from public.suppliers
    where id = purchase_row.supplier_id
      and workspace_id = target_workspace_id
    for update;
    if not found then
      raise exception 'The supplier attached to this purchase no longer exists';
    end if;

    select coalesce(sum(amount), 0) into purchased_for_supplier
    from public.transactions
    where workspace_id = target_workspace_id
      and transaction_type = 'purchase'
      and supplier_id = purchase_row.supplier_id
      and id <> target_purchase_id;
    select coalesce(sum(amount), 0) into non_linked_paid
    from public.supplier_payments
    where workspace_id = target_workspace_id
      and supplier_id = purchase_row.supplier_id
      and purchase_transaction_id is null;

    if non_linked_paid > purchased_for_supplier + supplier_row.opening_balance then
      raise exception 'This purchase cannot be cancelled because supplier payments would exceed the remaining supplier balance';
    end if;
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id,
    auth.uid(),
    'cancel',
    'purchase',
    target_purchase_id,
    jsonb_build_object('quantity', purchase_quantity, 'amount', purchase_row.amount, 'product_id', purchase_item_row.product_id)
  );

  delete from public.supplier_payments
  where workspace_id = target_workspace_id
    and purchase_transaction_id = target_purchase_id;
  delete from public.stock_movements
  where workspace_id = target_workspace_id
    and transaction_id = target_purchase_id;

  update public.products
  set stock_quantity = stock_quantity - purchase_quantity,
      received_quantity = received_quantity - purchase_quantity,
      cost_price = coalesce((
        select movement.unit_cost
        from public.stock_movements movement
        where movement.workspace_id = target_workspace_id
          and movement.product_id = product_row.id
          and movement.quantity_delta > 0
          and movement.movement_type in ('purchase', 'trade-in', 'adjustment')
        order by movement.created_at desc, movement.id desc
        limit 1
      ), cost_price)
  where id = product_row.id
    and workspace_id = target_workspace_id;

  delete from public.transactions
  where id = target_purchase_id
    and workspace_id = target_workspace_id;

  return target_purchase_id;
end;
$$;

revoke all on function public.cancel_purchase(uuid, uuid) from public, anon;
grant execute on function public.cancel_purchase(uuid, uuid) to authenticated;
