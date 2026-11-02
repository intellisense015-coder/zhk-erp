-- Permission enforcement for ERP reads and mutations.
--
-- The navigation layer is only a usability layer. This migration makes the
-- permission matrix authoritative in Postgres as well. Owners retain full
-- access; users-management operations remain owner-only.

create or replace function public.require_workspace_permission(
  target_workspace_id uuid,
  target_permission_key text,
  requested_action text default 'edit'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_workspace_permission(
    target_workspace_id,
    target_permission_key,
    requested_action
  ) then
    raise exception 'Permission denied for % % access', target_permission_key, requested_action
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.has_workspace_any_permission(
  target_workspace_id uuid,
  target_permission_keys text[],
  requested_action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_or(public.has_workspace_permission(
    target_workspace_id,
    permission_key,
    requested_action
  )), false)
  from unnest(target_permission_keys) as permission_key;
$$;

revoke all on function public.require_workspace_permission(uuid, text, text) from public, anon, authenticated;
revoke all on function public.has_workspace_any_permission(uuid, text[], text) from public, anon;
grant execute on function public.has_workspace_any_permission(uuid, text[], text) to authenticated;

-- Add exact domain permission checks to every business mutation. The old
-- role-only checks are removed for these functions so an owner-granted Edit
-- permission works for staff and managers as intended. User-management RPCs
-- are deliberately excluded and remain owner-only.
do $$
declare
  operation record;
  function_definition text;
  guarded_definition text;
begin
  for operation in
    select * from (values
      ('public.create_product(uuid,jsonb)', 'inventory'),
      ('public.update_product(uuid,uuid,jsonb)', 'inventory'),
      ('public.delete_product(uuid,uuid)', 'inventory'),
      ('public.record_purchase(uuid,jsonb)', 'purchases'),
      ('public.update_purchase(uuid,uuid,jsonb)', 'purchases'),
      ('public.record_sale(uuid,jsonb)', 'pos'),
      ('public.update_sale(uuid,uuid,jsonb)', 'sales'),
      ('public.record_exchange(uuid,jsonb)', 'pos'),
      ('public.record_transfer(uuid,jsonb)', 'transfers'),
      ('public.record_expense(uuid,jsonb)', 'expenses'),
      ('public.create_expense_category(uuid,text)', 'expenses'),
      ('public.update_expense(uuid,uuid,jsonb)', 'expenses'),
      ('public.delete_expense(uuid,uuid)', 'expenses'),
      ('public.create_customer(uuid,jsonb)', 'customers'),
      ('public.update_customer(uuid,uuid,jsonb)', 'customers'),
      ('public.delete_customer(uuid,uuid)', 'customers'),
      ('public.create_supplier(uuid,jsonb)', 'suppliers'),
      ('public.update_supplier(uuid,uuid,jsonb)', 'suppliers'),
      ('public.delete_supplier(uuid,uuid)', 'suppliers'),
      ('public.create_capital_account(uuid,jsonb)', 'capital'),
      ('public.create_capital_entry(uuid,jsonb)', 'capital'),
      ('public.record_supplier_payment(uuid,jsonb)', 'suppliers')
    ) as mapped(function_signature, permission_key)
  loop
    if to_regprocedure(operation.function_signature) is null then
      raise exception 'Required permission RPC is missing: %', operation.function_signature;
    end if;

    select pg_get_functiondef(to_regprocedure(operation.function_signature))
      into function_definition;

    if position('public.require_workspace_permission(' in function_definition) > 0 then
      continue;
    end if;

    guarded_definition := regexp_replace(
      function_definition,
      E'\n[[:space:]]*BEGIN[[:space:]]*\n',
      E'\nBEGIN\n  PERFORM public.require_workspace_permission(target_workspace_id, ' || quote_literal(operation.permission_key) || ', ''edit'');\n',
      1,
      1,
      'i'
    );

    if guarded_definition = function_definition then
      raise exception 'Could not place permission guard in: %', operation.function_signature;
    end if;

    -- Remove the legacy manager/owner role gates from business functions.
    -- Permission ownership is now expressed by the View/Edit matrix.
    guarded_definition := regexp_replace(
      guarded_definition,
      E'[[:space:]]*if[[:space:]]+public\\.workspace_role\\(target_workspace_id\\)[[:space:]]+not[[:space:]]+in[[:space:]]*\\([[:space:]]*''owner''[[:space:]]*,[[:space:]]*''manager''[[:space:]]*\\)[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+''[^;]*;[[:space:]]*end[[:space:]]+if;',
      '',
      'gi'
    );
    guarded_definition := regexp_replace(
      guarded_definition,
      E'[[:space:]]*if[[:space:]]+public\\.workspace_role\\(target_workspace_id\\)[[:space:]]*<>[[:space:]]*''owner''[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+''[^;]*;[[:space:]]*end[[:space:]]+if;',
      '',
      'gi'
    );

    if position('public.workspace_role(target_workspace_id)' in guarded_definition) > 0 then
      raise exception 'Could not remove legacy role guard from: %', operation.function_signature;
    end if;

    execute guarded_definition;
  end loop;
end;
$$;

-- Invoice numbers are an internal operation of authorized business RPCs, not
-- a standalone client capability.
revoke all on function public.next_invoice_number(uuid, date) from authenticated;

-- Business profile editing follows the Settings Edit permission. User
-- management remains owner-only in its dedicated RPCs.
do $$
declare
  function_definition text;
  guarded_definition text;
begin
  if to_regprocedure('public.update_workspace_profile(uuid,jsonb)') is null then
    raise exception 'Required Settings RPC is missing';
  end if;

  select pg_get_functiondef(to_regprocedure('public.update_workspace_profile(uuid,jsonb)'))
    into function_definition;

  guarded_definition := regexp_replace(
    function_definition,
    E'\n[[:space:]]*BEGIN[[:space:]]*\n',
    E'\nBEGIN\n  PERFORM public.require_workspace_permission(target_workspace_id, ''settings'', ''edit'');\n',
    1,
    1,
    'i'
  );
  guarded_definition := replace(guarded_definition, 'and owner_id = auth.uid()', 'and public.is_workspace_member(target_workspace_id)');
  guarded_definition := replace(guarded_definition, 'Only the workspace owner can update business settings', 'Settings Edit permission is required');

  if guarded_definition = function_definition
     or position('and owner_id = auth.uid()' in guarded_definition) > 0 then
    raise exception 'Could not place Settings permission guard';
  end if;

  execute guarded_definition;
end;
$$;

-- Workspace profile reads and writes are permission-controlled. The
-- restrictive MFA policy created by the MFA migration remains in force.
drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_permission_read
on public.workspaces
for select to authenticated
using (public.has_workspace_permission(id, 'settings', 'view'));

drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_settings_update
on public.workspaces
for update to authenticated
using (public.has_workspace_permission(id, 'settings', 'edit'))
with check (public.has_workspace_permission(id, 'settings', 'edit'));

-- Every ERP read is scoped to its own feature permission. Some records are
-- shared supporting data for a feature (for example, POS needs products and
-- customers), so those supporting read paths are listed explicitly.
drop policy if exists products_member_read on public.products;
create policy products_permission_read
on public.products
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'inventory', 'pos', 'purchases', 'transfers'], 'view'));

drop policy if exists customers_member_read on public.customers;
create policy customers_permission_read
on public.customers
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['customers', 'pos', 'sales', 'transfers'], 'view'));

drop policy if exists suppliers_member_read on public.suppliers;
create policy suppliers_permission_read
on public.suppliers
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'suppliers', 'pos', 'purchases', 'transfers'], 'view'));

drop policy if exists expense_categories_member_read on public.expense_categories;
create policy expense_categories_permission_read
on public.expense_categories
for select to authenticated
using (public.has_workspace_permission(workspace_id, 'expenses', 'view'));

drop policy if exists capital_accounts_member_read on public.capital_accounts;
create policy capital_accounts_permission_read
on public.capital_accounts
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['capital', 'purchases'], 'view'));

drop policy if exists capital_entries_member_read on public.capital_entries;
create policy capital_entries_permission_read
on public.capital_entries
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['capital', 'purchases'], 'view'));

drop policy if exists transactions_member_read on public.transactions;
create policy transactions_permission_read
on public.transactions
for select to authenticated
using (
  public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'invoices'], 'view')
  or (transaction_type = 'sale' and public.has_workspace_any_permission(workspace_id, array['sales', 'pos'], 'view'))
  or (transaction_type = 'purchase' and public.has_workspace_permission(workspace_id, 'purchases', 'view'))
  or (transaction_type = 'transfer' and public.has_workspace_permission(workspace_id, 'transfers', 'view'))
);

drop policy if exists sale_items_member_read on public.sale_items;
create policy sale_items_permission_read
on public.sale_items
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'invoices', 'sales', 'pos'], 'view'));

drop policy if exists purchase_items_member_read on public.purchase_items;
create policy purchase_items_permission_read
on public.purchase_items
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'invoices', 'purchases'], 'view'));

drop policy if exists supplier_payments_member_read on public.supplier_payments;
create policy supplier_payments_permission_read
on public.supplier_payments
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'suppliers', 'purchases'], 'view'));

drop policy if exists expenses_member_read on public.expenses;
create policy expenses_permission_read
on public.expenses
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'expenses'], 'view'));

drop policy if exists stock_movements_member_read on public.stock_movements;
create policy stock_movements_permission_read
on public.stock_movements
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'inventory', 'pos', 'purchases', 'sales', 'transfers'], 'view'));

drop policy if exists invoice_sequences_member_read on public.invoice_sequences;
create policy invoice_sequences_permission_read
on public.invoice_sequences
for select to authenticated
using (public.has_workspace_any_permission(workspace_id, array['dashboard', 'reports', 'transactions', 'invoices'], 'view'));

drop policy if exists audit_logs_member_read on public.audit_logs;
create policy audit_logs_permission_read
on public.audit_logs
for select to authenticated
using (public.has_workspace_permission(workspace_id, 'audit_logs', 'view'));

-- Members may always read their own active membership so the shell can verify
-- access. Workspace administration remains owner-only.
drop policy if exists workspace_members_member_read on public.workspace_members;
create policy workspace_members_permission_read
on public.workspace_members
for select to authenticated
using (
  status = 'active'
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspaces workspace
      where workspace.id = workspace_members.workspace_id
        and workspace.owner_id = auth.uid()
    )
  )
);

drop policy if exists permission_catalog_mfa_read on public.permission_catalog;
create policy permission_catalog_users_read
on public.permission_catalog
for select to authenticated
using (
  exists (
    select 1
    from public.workspace_members member
    where member.user_id = auth.uid()
      and member.status = 'active'
      and exists (
        select 1
        from public.workspaces workspace
        where workspace.id = member.workspace_id
          and workspace.owner_id = auth.uid()
      )
  )
);

drop policy if exists workspace_designations_member_read on public.workspace_designations;
create policy workspace_designations_users_read
on public.workspace_designations
for select to authenticated
using (
  exists (
    select 1
    from public.workspaces workspace
    where workspace.id = workspace_designations.workspace_id
      and workspace.owner_id = auth.uid()
  )
);

drop policy if exists workspace_member_permissions_member_read on public.workspace_member_permissions;
create policy workspace_member_permissions_permission_read
on public.workspace_member_permissions
for select to authenticated
using (
  public.is_mfa_verified()
  and public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspaces workspace
      where workspace.id = workspace_member_permissions.workspace_id
        and workspace.owner_id = auth.uid()
    )
  )
);
