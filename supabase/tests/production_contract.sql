-- Run this in the Supabase SQL Editor against the production project after
-- applying all migrations. It performs read-only schema and privilege checks.

do $$
declare
  required_table text;
  required_tables text[] := array[
    'workspaces', 'workspace_members', 'products', 'customers', 'suppliers',
    'capital_accounts', 'capital_entries', 'transactions', 'sale_items',
    'purchase_items', 'supplier_payments', 'expenses', 'stock_movements',
    'audit_logs'
  ];
  required_rpc text;
  required_rpcs text[] := array[
    'public.create_workspace(text,text,text,text,text,text,text)',
    'public.create_product(uuid,jsonb)',
    'public.create_product_with_capital(uuid,jsonb)',
    'public.record_purchase(uuid,jsonb)',
    'public.record_sale(uuid,jsonb)',
    'public.create_capital_account(uuid,jsonb)',
    'public.create_capital_entry(uuid,jsonb)',
    'public.update_capital_account(uuid,uuid,jsonb)',
    'public.update_capital_entry(uuid,uuid,jsonb)',
    'public.update_purchase(uuid,uuid,jsonb)',
    'public.cancel_purchase(uuid,uuid)'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Missing required table: public.%', required_table;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || required_table)
        and relrowsecurity
    ) then
      raise exception 'RLS is not enabled on required table: public.%', required_table;
    end if;
  end loop;

  foreach required_rpc in array required_rpcs loop
    if to_regprocedure(required_rpc) is null then
      raise exception 'Missing required RPC: %', required_rpc;
    end if;
  end loop;
end;
$$;

select 'production schema contract passed' as result;
