-- Make Data API privileges explicit. RLS remains the row-level boundary; these
-- grants ensure anonymous users have no table access and authenticated users
-- cannot bypass approved security-definer mutation RPCs.

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

revoke all on all functions in schema public from anon;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.create_workspace(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.next_invoice_number(uuid, date) to authenticated;
grant execute on function public.create_product(uuid, jsonb) to authenticated;
grant execute on function public.update_product(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_product(uuid, uuid) to authenticated;
grant execute on function public.record_purchase(uuid, jsonb) to authenticated;

create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);
