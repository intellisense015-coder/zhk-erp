-- Secure expense recording operation.
-- Expense totals, dates, invoice numbering, and audit data are server-owned.

create or replace function public.record_expense(
  target_workspace_id uuid,
  expense_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  expense_id uuid;
  invoice_number text;
  expense_category text := nullif(trim(coalesce(expense_payload->>'category', '')), '');
  expense_description text := nullif(trim(coalesce(expense_payload->>'description', '')), '');
  expense_amount numeric := coalesce(nullif(expense_payload->>'amount', '')::numeric, 0);
  payment_method text := nullif(trim(coalesce(expense_payload->>'payment_method', '')), '');
  expense_note text := nullif(trim(coalesce(expense_payload->>'note', '')), '');
  expense_date date := (now() at time zone 'Asia/Karachi')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to record expenses';
  end if;

  if expense_category is null or length(expense_category) > 80 then
    raise exception 'Choose a valid expense category';
  end if;
  if expense_description is null or length(expense_description) > 240 then
    raise exception 'Enter a valid expense description';
  end if;
  if expense_amount <= 0 or expense_amount > 999999999999.99 then
    raise exception 'Expense amount must be greater than zero';
  end if;
  if payment_method is not null and payment_method not in ('Cash', 'Bank transfer', 'Card', 'Other') then
    raise exception 'Payment method is invalid';
  end if;
  if expense_note is not null and length(expense_note) > 500 then
    raise exception 'Expense note is too long';
  end if;

  invoice_number := public.next_invoice_number(target_workspace_id, expense_date);

  insert into public.expenses (
    workspace_id, invoice_number, category, description, amount,
    occurred_on, payment_method, note, created_by
  ) values (
    target_workspace_id, invoice_number, expense_category, expense_description,
    expense_amount, expense_date, payment_method, expense_note, auth.uid()
  ) returning id into expense_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'create', 'expense', expense_id,
    jsonb_build_object(
      'invoice_number', invoice_number,
      'category', expense_category,
      'amount', expense_amount,
      'payment_method', payment_method
    )
  );

  return expense_id;
end;
$$;

revoke all on function public.record_expense(uuid, jsonb) from public;
grant execute on function public.record_expense(uuid, jsonb) to authenticated;
