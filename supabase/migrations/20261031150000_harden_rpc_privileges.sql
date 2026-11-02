-- Remove implicit/public RPC execution and allow only authenticated callers
-- for application RPCs. SECURITY DEFINER functions must never be callable by
-- the anonymous role.

do $$
declare
  function_record record;
begin
  for function_record in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
  loop
    execute format(
      'revoke all privileges on function %s from public, anon',
      function_record.function_signature
    );
  end loop;
end;
$$;

do $$
declare
  approved_function text;
begin
  foreach approved_function in array array[
    'public.create_workspace(text,text,text,text,text,text,text)',
    'public.is_workspace_member(uuid)',
    'public.workspace_role(uuid)',
    'public.next_invoice_number(uuid,date)',
    'public.create_product(uuid,jsonb)',
    'public.update_product(uuid,uuid,jsonb)',
    'public.delete_product(uuid,uuid)',
    'public.create_customer(uuid,jsonb)',
    'public.update_customer(uuid,uuid,jsonb)',
    'public.delete_customer(uuid,uuid)',
    'public.create_supplier(uuid,jsonb)',
    'public.update_supplier(uuid,uuid,jsonb)',
    'public.delete_supplier(uuid,uuid)',
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
    'public.create_capital_account(uuid,jsonb)',
    'public.create_capital_entry(uuid,jsonb)',
    'public.record_supplier_payment(uuid,jsonb)',
    'public.update_workspace_profile(uuid,jsonb)'
  ]
  loop
    if to_regprocedure(approved_function) is not null then
      execute format(
        'grant execute on function %s to authenticated',
        approved_function
      );
    end if;
  end loop;
end;
$$;
