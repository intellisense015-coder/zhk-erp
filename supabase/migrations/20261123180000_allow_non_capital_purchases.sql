-- Allow supplier-credit and other-funded stock purchases without a capital account.
-- Capital-funded purchases keep the existing full-reservation and balance guardrail.

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

  if coalesce(new.funding_source, 'supplier-credit') <> 'capital' then
    if new.capital_id is not null then
      raise exception 'A capital account can only be used with business capital funding';
    end if;
    return new;
  end if;

  if new.capital_id is null then
    raise exception 'Every capital-funded supplier purchase must use a capital account';
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

revoke all on function public.enforce_capital_purchase_balance() from public, anon, authenticated;
