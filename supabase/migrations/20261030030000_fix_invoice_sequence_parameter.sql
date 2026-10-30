-- Resolve the invoice-date parameter/column name collision in the sequence RPC.

create or replace function public.next_invoice_number(
  target_workspace_id uuid,
  invoice_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  insert into public.invoice_sequences (workspace_id, invoice_date, last_sequence)
  values (target_workspace_id, invoice_date, 1)
  on conflict on constraint invoice_sequences_pkey
  do update set last_sequence = public.invoice_sequences.last_sequence + 1
  returning last_sequence into next_sequence;

  return format(
    'ZHK-%s%s',
    to_char(invoice_date, 'YYMMDD'),
    case when next_sequence = 1 then '' else '-' || lpad(next_sequence::text, 2, '0') end
  );
end;
$$;

revoke all on function public.next_invoice_number(uuid, date) from public;
grant execute on function public.next_invoice_number(uuid, date) to authenticated;
