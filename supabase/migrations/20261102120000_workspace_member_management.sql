-- Secure owner-only workspace member management.
-- Member records are never mutated directly from the browser. These RPCs
-- require an authenticated AAL2 session and write an audit record for each
-- membership change.

create or replace function public.list_workspace_members(target_workspace_id uuid)
returns table (
  user_id uuid,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_mfa();

  if not exists (
    select 1
    from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can view members';
  end if;

  return query
  select member.user_id, member.role, member.created_at
  from public.workspace_members member
  where member.workspace_id = target_workspace_id
  order by case member.role
    when 'owner' then 1
    when 'manager' then 2
    else 3
  end, member.created_at;
end;
$$;

create or replace function public.add_workspace_member(
  target_workspace_id uuid,
  member_user_id uuid,
  member_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_owner_id uuid;
  normalized_role text := lower(trim(member_role));
begin
  perform public.require_mfa();

  select workspace.owner_id
    into workspace_owner_id
  from public.workspaces workspace
  where workspace.id = target_workspace_id
  for update;

  if workspace_owner_id is null or workspace_owner_id <> auth.uid() then
    raise exception 'Only the workspace owner can add members';
  end if;

  if member_user_id is null or member_user_id = workspace_owner_id then
    raise exception 'The workspace owner is already a member';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'New members can only be managers or staff';
  end if;

  if not exists (select 1 from auth.users where id = member_user_id) then
    raise exception 'The selected Auth user does not exist';
  end if;

  if exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = member_user_id
  ) then
    raise exception 'This user is already a workspace member';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, member_user_id, normalized_role);

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'create',
    'workspace_member',
    member_user_id,
    jsonb_build_object('role', normalized_role)
  );
end;
$$;

create or replace function public.update_workspace_member_role(
  target_workspace_id uuid,
  member_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_owner_id uuid;
  previous_role text;
  normalized_role text := lower(trim(new_role));
begin
  perform public.require_mfa();

  select workspace.owner_id
    into workspace_owner_id
  from public.workspaces workspace
  where workspace.id = target_workspace_id
  for update;

  if workspace_owner_id is null or workspace_owner_id <> auth.uid() then
    raise exception 'Only the workspace owner can change member roles';
  end if;

  if member_user_id = workspace_owner_id then
    raise exception 'The workspace owner role cannot be changed';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'Members can only be managers or staff';
  end if;

  select member.role
    into previous_role
  from public.workspace_members member
  where member.workspace_id = target_workspace_id
    and member.user_id = member_user_id
  for update;

  if not found then
    raise exception 'Workspace member was not found';
  end if;

  if previous_role = normalized_role then
    return;
  end if;

  update public.workspace_members
  set role = normalized_role
  where workspace_id = target_workspace_id
    and user_id = member_user_id
    and role is distinct from normalized_role;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'workspace_member',
    member_user_id,
    jsonb_build_object('previous_role', previous_role, 'new_role', normalized_role)
  );
end;
$$;

create or replace function public.remove_workspace_member(
  target_workspace_id uuid,
  member_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_owner_id uuid;
  removed_role text;
begin
  perform public.require_mfa();

  select workspace.owner_id
    into workspace_owner_id
  from public.workspaces workspace
  where workspace.id = target_workspace_id
  for update;

  if workspace_owner_id is null or workspace_owner_id <> auth.uid() then
    raise exception 'Only the workspace owner can remove members';
  end if;

  if member_user_id = workspace_owner_id then
    raise exception 'The workspace owner cannot be removed';
  end if;

  delete from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = member_user_id
  returning role into removed_role;

  if not found then
    raise exception 'Workspace member was not found';
  end if;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'delete',
    'workspace_member',
    member_user_id,
    jsonb_build_object('previous_role', removed_role)
  );
end;
$$;

revoke all on function public.list_workspace_members(uuid) from public, anon, authenticated;
revoke all on function public.add_workspace_member(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_workspace_member_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon, authenticated;

grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.add_workspace_member(uuid, uuid, text) to authenticated;
grant execute on function public.update_workspace_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

drop policy if exists workspace_members_member_read on public.workspace_members;

create policy workspace_members_member_read on public.workspace_members
for select to authenticated
using (
  user_id = auth.uid()
  or (
    public.is_workspace_member(workspace_id)
    and public.workspace_role(workspace_id) in ('owner', 'manager')
  )
);
