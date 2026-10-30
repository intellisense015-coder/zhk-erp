-- Secure expense-category creation.

create or replace function public.create_expense_category(
  target_workspace_id uuid,
  category_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_category_id uuid;
  normalized_name text := nullif(trim(category_name), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required to create expense categories';
  end if;

  if normalized_name is null or length(normalized_name) > 80 then
    raise exception 'Enter a valid expense category name';
  end if;

  if exists (
    select 1
      from public.expense_categories
     where workspace_id = target_workspace_id
       and lower(name) = lower(normalized_name)
  ) then
    raise exception 'This expense category already exists';
  end if;

  insert into public.expense_categories (workspace_id, name)
  values (target_workspace_id, normalized_name)
  returning id into new_category_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    target_workspace_id, auth.uid(), 'create', 'expense_category', new_category_id,
    jsonb_build_object('name', normalized_name)
  );

  return new_category_id;
end;
$$;

revoke all on function public.create_expense_category(uuid, text) from public;
grant execute on function public.create_expense_category(uuid, text) to authenticated;
