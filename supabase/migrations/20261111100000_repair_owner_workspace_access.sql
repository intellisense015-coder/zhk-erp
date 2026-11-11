-- Repair owner access for workspaces created before the access-control rollout.
-- The client may call this only as a recovery step after the normal membership
-- read returns no row. It can never grant access to a non-owner.

alter table public.workspace_members
  add column if not exists status text not null default 'active',
  add column if not exists accepted_at timestamptz;

create or replace function public.ensure_workspace_owner_access(
  target_workspace_id uuid default null
)
returns table (
  workspace_id uuid,
  user_id uuid,
  member_name text,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_workspace_id uuid;
  owner_name text;
begin
  if auth.uid() is null then
    return;
  end if;

  perform public.require_mfa();

  select workspace.id,
         nullif(trim(concat_ws(' ', workspace.owner_first_name, workspace.owner_second_name)), '')
    into owner_workspace_id, owner_name
  from public.workspaces workspace
  where workspace.owner_id = auth.uid()
    and (target_workspace_id is null or workspace.id = target_workspace_id)
  order by workspace.created_at desc
  limit 1;

  if owner_workspace_id is null then
    return;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, accepted_at)
  values (owner_workspace_id, auth.uid(), 'owner', 'active', now())
  on conflict (workspace_id, user_id) do update
    set role = 'owner',
        status = 'active';

  return query
  select owner_workspace_id,
         auth.uid(),
         coalesce(owner_name, split_part(auth.jwt() ->> 'email', '@', 1), 'Workspace owner'),
         'owner'::text,
         'active'::text;
end;
$$;

revoke all on function public.ensure_workspace_owner_access(uuid) from public, anon;
grant execute on function public.ensure_workspace_owner_access(uuid) to authenticated;
