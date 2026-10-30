-- Secure expense editing and deletion.

create or replace function public.update_expense(
  target_workspace_id uuid,
  target_expense_id uuid,
  expense_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expense_category text := nullif(trim(coalesce(expense_payload->>'category', '')), '');
  expense_description text := nullif(trim(coalesce(expense_payload->>'description', '')), '');
  expense_amount numeric := coalesce(nullif(expense_payload->>'amount', '')::numeric, 0);
  payment_method text := nullif(trim(coalesce(expense_payload->>'payment_method', '')), '');
  expense_note text := nullif(trim(coalesce(expense_payload->>'note', '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to edit expenses';
  end if;
  if not exists (select 1 from public.expenses where id = target_expense_id and workspace_id = target_workspace_id) then
    raise exception 'Expense record not found';
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

  update public.expenses
     set category = expense_category,
         description = expense_description,
         amount = expense_amount,
         payment_method = payment_method,
         note = expense_note,
         updated_at = now()
   where id = target_expense_id
     and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'update', 'expense', target_expense_id,
    jsonb_build_object('category', expense_category, 'amount', expense_amount, 'payment_method', payment_method)
  );
end;
$$;

create or replace function public.delete_expense(
  target_workspace_id uuid,
  target_expense_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_invoice_number text;
  deleted_category text;
  deleted_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if public.workspace_role(target_workspace_id) <> 'owner' then
    raise exception 'Owner access is required to delete expenses';
  end if;

  select invoice_number, category, amount
    into deleted_invoice_number, deleted_category, deleted_amount
    from public.expenses
   where id = target_expense_id
     and workspace_id = target_workspace_id
   for update;
  if not found then
    raise exception 'Expense record not found';
  end if;

  delete from public.expenses
   where id = target_expense_id
     and workspace_id = target_workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'delete', 'expense', target_expense_id,
    jsonb_build_object('invoice_number', deleted_invoice_number, 'category', deleted_category, 'amount', deleted_amount)
  );
end;
$$;

revoke all on function public.update_expense(uuid, uuid, jsonb) from public;
revoke all on function public.delete_expense(uuid, uuid) from public;
grant execute on function public.update_expense(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_expense(uuid, uuid) to authenticated;
