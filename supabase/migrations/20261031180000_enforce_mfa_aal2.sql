-- Require a verified Microsoft Authenticator TOTP session for ERP data.
-- Supabase Auth places aal2 in the signed JWT after mfa.verify succeeds.

create or replace function public.is_mfa_verified()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.require_mfa()
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_mfa_verified() then
    raise exception 'Microsoft Authenticator verification is required';
  end if;
end;
$$;

revoke all on function public.is_mfa_verified() from public, anon;
grant execute on function public.is_mfa_verified() to authenticated;
revoke all on function public.require_mfa() from public, anon, authenticated;

-- Add the MFA check to every approved ERP mutation without changing the
-- existing validation, locking, balance, stock, or audit logic.
do $$
declare
  approved_function text;
  function_definition text;
  guarded_definition text;
begin
  foreach approved_function in array array[
    'public.create_workspace(text,text,text,text,text,text,text)',
    'public.next_invoice_number(uuid,date)',
    'public.create_product(uuid,jsonb)',
    'public.update_product(uuid,uuid,jsonb)',
    'public.delete_product(uuid,uuid)',
    'public.record_purchase(uuid,jsonb)',
    'public.update_purchase(uuid,uuid,jsonb)',
    'public.record_sale(uuid,jsonb)',
    'public.update_sale(uuid,uuid,jsonb)',
    'public.record_transfer(uuid,jsonb)',
    'public.record_exchange(uuid,jsonb)',
    'public.record_expense(uuid,jsonb)',
    'public.create_expense_category(uuid,text)',
    'public.update_expense(uuid,uuid,jsonb)',
    'public.delete_expense(uuid,uuid)',
    'public.create_customer(uuid,jsonb)',
    'public.update_customer(uuid,uuid,jsonb)',
    'public.delete_customer(uuid,uuid)',
    'public.create_supplier(uuid,jsonb)',
    'public.update_supplier(uuid,uuid,jsonb)',
    'public.delete_supplier(uuid,uuid)',
    'public.create_capital_account(uuid,jsonb)',
    'public.create_capital_entry(uuid,jsonb)',
    'public.record_supplier_payment(uuid,jsonb)',
    'public.update_workspace_profile(uuid,jsonb)'
  ]
  loop
    if to_regprocedure(approved_function) is null then
      raise exception 'Required RPC is missing: %', approved_function;
    end if;

    select pg_get_functiondef(to_regprocedure(approved_function))
      into function_definition;

    if position('public.require_mfa()' in function_definition) > 0 then
      continue;
    end if;

    guarded_definition := regexp_replace(
      function_definition,
      E'\n[[:space:]]*BEGIN[[:space:]]*\n',
      E'\nBEGIN\n  PERFORM public.require_mfa();\n',
      'i'
    );

    if guarded_definition = function_definition then
      raise exception 'Could not place MFA guard in: %', approved_function;
    end if;

    execute guarded_definition;
  end loop;
end;
$$;

-- Direct authenticated reads of financial and inventory tables also require
-- aal2. Existing workspace-member predicates still provide tenant isolation.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workspaces',
    'products',
    'customers',
    'suppliers',
    'expense_categories',
    'capital_accounts',
    'capital_entries',
    'transactions',
    'sale_items',
    'purchase_items',
    'supplier_payments',
    'expenses',
    'stock_movements',
    'invoice_sequences',
    'audit_logs'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required ERP table is missing: %', table_name;
    end if;

    execute format(
      'drop policy if exists mfa_required_for_erp_reads on public.%I',
      table_name
    );
    execute format(
      'create policy mfa_required_for_erp_reads on public.%I as restrictive for select to authenticated using (public.is_mfa_verified())',
      table_name
    );
  end loop;
end;
$$;
