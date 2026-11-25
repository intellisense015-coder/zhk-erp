-- Apply the capital Edit permission to editing RPCs introduced after the
-- original permission-enforcement migration. The function rewrite is guarded
-- so it is safe to rerun and does not duplicate the permission check.

do $$
declare
  operation record;
  function_definition text;
  guarded_definition text;
begin
  for operation in
    select * from (values
      ('public.update_capital_account(uuid,uuid,jsonb)', 'capital'),
      ('public.update_capital_entry(uuid,uuid,jsonb)', 'capital')
    ) as mapped(function_signature, permission_key)
  loop
    if to_regprocedure(operation.function_signature) is null then
      raise exception 'Required capital permission RPC is missing: %', operation.function_signature;
    end if;

    select pg_get_functiondef(to_regprocedure(operation.function_signature))
      into function_definition;

    if position('public.require_workspace_permission(' in function_definition) > 0 then
      continue;
    end if;

    guarded_definition := regexp_replace(
      function_definition,
      chr(10) || '[[:space:]]*BEGIN[[:space:]]*' || chr(10),
      chr(10) || 'BEGIN' || chr(10) || '  PERFORM public.require_workspace_permission(target_workspace_id, ' || quote_literal(operation.permission_key) || ', ''edit'');' || chr(10),
      1,
      1,
      'i'
    );

    if guarded_definition = function_definition then
      raise exception 'Could not place capital permission guard in: %', operation.function_signature;
    end if;

    execute guarded_definition;
  end loop;
end;
$$;
