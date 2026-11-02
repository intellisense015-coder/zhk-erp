-- Owner-controlled access-management RPCs.
-- Invitations are created here, while email delivery is performed later by a
-- server-only route using Supabase Auth Admin APIs.

create or replace function public.validate_permission_snapshot(
  target_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  permission_entry record;
  can_view_value boolean;
  can_edit_value boolean;
begin
  if target_permissions is null
     or jsonb_typeof(target_permissions) <> 'object' then
    raise exception 'Permissions must be a JSON object';
  end if;

  for permission_entry in
    select entry.key, entry.value
    from jsonb_each(target_permissions) entry
  loop
    if not exists (
      select 1
      from public.permission_catalog catalog
      where catalog.permission_key = permission_entry.key
    ) then
      raise exception 'Unknown permission: %', permission_entry.key;
    end if;

    if jsonb_typeof(permission_entry.value) <> 'object' then
      raise exception 'Permission configuration must be an object';
    end if;

    if permission_entry.value ? 'can_view'
       and jsonb_typeof(permission_entry.value -> 'can_view') <> 'boolean' then
      raise exception 'can_view must be boolean';
    end if;

    if permission_entry.value ? 'can_edit'
       and jsonb_typeof(permission_entry.value -> 'can_edit') <> 'boolean' then
      raise exception 'can_edit must be boolean';
    end if;

    can_view_value := coalesce((permission_entry.value ->> 'can_view')::boolean, false);
    can_edit_value := coalesce((permission_entry.value ->> 'can_edit')::boolean, false);

    if can_edit_value and not can_view_value then
      raise exception 'Edit permission requires view permission';
    end if;
  end loop;
end;
$$;

create or replace function public.list_workspace_access(target_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  designation_id uuid,
  designation_name text,
  invited_at timestamptz,
  accepted_at timestamptz,
  deactivated_at timestamptz,
  permissions jsonb
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
    raise exception 'Only the workspace owner can view access settings';
  end if;

  return query
  select
    member.user_id,
    coalesce(auth_user.email, ''),
    member.role,
    member.status,
    member.designation_id,
    designation.name,
    member.invited_at,
    member.accepted_at,
    member.deactivated_at,
    coalesce((
      select jsonb_object_agg(
        member_permission.permission_key,
        jsonb_build_object(
          'can_view', member_permission.can_view,
          'can_edit', member_permission.can_edit
        )
      )
      from public.workspace_member_permissions member_permission
      where member_permission.workspace_id = member.workspace_id
        and member_permission.user_id = member.user_id
    ), '{}'::jsonb)
  from public.workspace_members member
  left join auth.users auth_user on auth_user.id = member.user_id
  left join public.workspace_designations designation
    on designation.id = member.designation_id
  where member.workspace_id = target_workspace_id
  order by case member.role
    when 'owner' then 1
    when 'manager' then 2
    else 3
  end, lower(coalesce(auth_user.email, ''));
end;
$$;

create or replace function public.list_workspace_invitations(target_workspace_id uuid)
returns table (
  invitation_id uuid,
  email text,
  role text,
  status text,
  designation_id uuid,
  designation_name text,
  permission_snapshot jsonb,
  auth_user_id uuid,
  invited_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
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
    raise exception 'Only the workspace owner can view invitations';
  end if;

  return query
  select
    invitation.id,
    invitation.email,
    invitation.role,
    case
      when invitation.status = 'pending'
       and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end,
    invitation.designation_id,
    designation.name,
    invitation.permission_snapshot,
    invitation.auth_user_id,
    invitation.invited_at,
    invitation.expires_at,
    invitation.accepted_at,
    invitation.revoked_at
  from public.workspace_invitations invitation
  left join public.workspace_designations designation
    on designation.id = invitation.designation_id
  where invitation.workspace_id = target_workspace_id
  order by invitation.created_at desc;
end;
$$;

create or replace function public.create_workspace_designation(
  target_workspace_id uuid,
  designation_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_designation_id uuid;
  normalized_name text := trim(designation_name);
begin
  perform public.require_mfa();

  if not exists (
    select 1
    from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can create designations';
  end if;

  if length(normalized_name) not between 1 and 80 then
    raise exception 'Designation must contain between 1 and 80 characters';
  end if;

  if exists (
    select 1
    from public.workspace_designations designation
    where designation.workspace_id = target_workspace_id
      and lower(designation.name) = lower(normalized_name)
  ) then
    raise exception 'This designation already exists';
  end if;

  insert into public.workspace_designations (workspace_id, name, created_by)
  values (target_workspace_id, normalized_name, auth.uid())
  returning id into new_designation_id;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'create',
    'workspace_designation',
    new_designation_id,
    jsonb_build_object('name', normalized_name)
  );

  return new_designation_id;
end;
$$;

create or replace function public.create_workspace_invitation(
  target_workspace_id uuid,
  invitation_email text,
  target_designation_id uuid,
  target_role text,
  target_permissions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invitation_id uuid;
  normalized_email text := lower(trim(invitation_email));
  normalized_role text := lower(trim(target_role));
begin
  perform public.require_mfa();

  if not exists (
    select 1
    from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can send invitations';
  end if;

  if length(normalized_email) not between 3 and 320
     or position('@' in normalized_email) <= 1 then
    raise exception 'A valid invitation email is required';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'Invite role must be manager or staff';
  end if;

  if target_designation_id is not null
     and not exists (
       select 1
       from public.workspace_designations designation
       where designation.id = target_designation_id
         and designation.workspace_id = target_workspace_id
     ) then
    raise exception 'The selected designation does not belong to this workspace';
  end if;

  perform public.validate_permission_snapshot(target_permissions);

  if exists (
    select 1
    from public.workspace_members member
    join auth.users auth_user on auth_user.id = member.user_id
    where member.workspace_id = target_workspace_id
      and lower(auth_user.email) = normalized_email
      and member.status = 'active'
  ) then
    raise exception 'This email is already an active workspace member';
  end if;

  if exists (
    select 1
    from public.workspace_invitations invitation
    where invitation.workspace_id = target_workspace_id
      and lower(invitation.email) = normalized_email
      and invitation.status = 'pending'
      and invitation.expires_at > now()
  ) then
    raise exception 'A pending invitation already exists for this email';
  end if;

  insert into public.workspace_invitations (
    workspace_id,
    email,
    designation_id,
    role,
    permission_snapshot,
    invited_by
  )
  values (
    target_workspace_id,
    normalized_email,
    target_designation_id,
    normalized_role,
    target_permissions,
    auth.uid()
  )
  returning id into new_invitation_id;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'create',
    'workspace_invitation',
    new_invitation_id,
    jsonb_build_object(
      'email', normalized_email,
      'role', normalized_role,
      'designation_id', target_designation_id,
      'permission_snapshot', target_permissions
    )
  );

  return new_invitation_id;
end;
$$;

create or replace function public.attach_workspace_invitation_auth_user(
  target_invitation_id uuid,
  invited_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_mfa();

  if not exists (
    select 1
    from public.workspace_invitations invitation
    join public.workspaces workspace on workspace.id = invitation.workspace_id
    where invitation.id = target_invitation_id
      and workspace.owner_id = auth.uid()
      and invitation.status = 'pending'
  ) then
    raise exception 'Pending invitation was not found';
  end if;

  if not exists (select 1 from auth.users where id = invited_auth_user_id) then
    raise exception 'The invited Auth user does not exist';
  end if;

  update public.workspace_invitations invitation
  set auth_user_id = invited_auth_user_id,
      updated_at = now()
  where invitation.id = target_invitation_id;
end;
$$;

create or replace function public.accept_workspace_invitation(
  target_invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation record;
  auth_email text;
  existing_status text;
begin
  perform public.require_mfa();

  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select invitation_record.*
    into invitation
  from public.workspace_invitations invitation_record
  where invitation_record.id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation was not found';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'This invitation is no longer pending';
  end if;

  if invitation.expires_at <= now() then
    update public.workspace_invitations
    set status = 'expired', updated_at = now()
    where id = target_invitation_id;
    raise exception 'This invitation has expired';
  end if;

  select lower(auth_user.email)
    into auth_email
  from auth.users auth_user
  where auth_user.id = auth.uid();

  if invitation.auth_user_id is not null
     and invitation.auth_user_id <> auth.uid() then
    raise exception 'This invitation belongs to another account';
  end if;

  if invitation.auth_user_id is null
     and auth_email is distinct from lower(invitation.email) then
    raise exception 'Sign in with the invited email address';
  end if;

  select member.status
    into existing_status
  from public.workspace_members member
  where member.workspace_id = invitation.workspace_id
    and member.user_id = auth.uid()
  for update;

  if existing_status = 'active' then
    raise exception 'This account is already an active workspace member';
  elsif existing_status = 'deactivated' then
    update public.workspace_members
    set role = invitation.role,
        designation_id = invitation.designation_id,
        status = 'active',
        accepted_at = now(),
        deactivated_at = null,
        deactivated_by = null
    where workspace_id = invitation.workspace_id
      and user_id = auth.uid();
  else
    insert into public.workspace_members (
      workspace_id, user_id, role, designation_id,
      status, invited_at, accepted_at
    )
    values (
      invitation.workspace_id,
      auth.uid(),
      invitation.role,
      invitation.designation_id,
      'active',
      invitation.invited_at,
      now()
    );
  end if;

  delete from public.workspace_member_permissions
  where workspace_id = invitation.workspace_id
    and user_id = auth.uid();

  insert into public.workspace_member_permissions (
    workspace_id, user_id, permission_key, can_view, can_edit
  )
  select
    invitation.workspace_id,
    auth.uid(),
    entry.key,
    coalesce((entry.value ->> 'can_view')::boolean, false),
    coalesce((entry.value ->> 'can_edit')::boolean, false)
  from jsonb_each(invitation.permission_snapshot) entry
  where coalesce((entry.value ->> 'can_view')::boolean, false)
     or coalesce((entry.value ->> 'can_edit')::boolean, false);

  update public.workspace_invitations
  set status = 'accepted',
      auth_user_id = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = target_invitation_id;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    invitation.workspace_id,
    auth.uid(),
    'accept',
    'workspace_invitation',
    target_invitation_id,
    jsonb_build_object('member_user_id', auth.uid())
  );

  return invitation.workspace_id;
end;
$$;

create or replace function public.update_workspace_member_access(
  target_workspace_id uuid,
  member_user_id uuid,
  new_role text,
  new_designation_id uuid,
  new_status text,
  new_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_role text;
  previous_status text;
  normalized_role text := lower(trim(new_role));
  normalized_status text := lower(trim(new_status));
begin
  perform public.require_mfa();

  if not exists (
    select 1
    from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can update access';
  end if;

  if member_user_id = auth.uid()
     or exists (
       select 1
       from public.workspaces workspace
       where workspace.id = target_workspace_id
         and workspace.owner_id = member_user_id
     ) then
    raise exception 'The workspace owner access cannot be changed here';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'Member role must be manager or staff';
  end if;

  if normalized_status not in ('active', 'deactivated') then
    raise exception 'Member status must be active or deactivated';
  end if;

  if new_designation_id is not null
     and not exists (
       select 1
       from public.workspace_designations designation
       where designation.id = new_designation_id
         and designation.workspace_id = target_workspace_id
     ) then
    raise exception 'The selected designation does not belong to this workspace';
  end if;

  perform public.validate_permission_snapshot(new_permissions);

  select member.role, member.status
    into previous_role, previous_status
  from public.workspace_members member
  where member.workspace_id = target_workspace_id
    and member.user_id = member_user_id
  for update;

  if not found then
    raise exception 'Workspace member was not found';
  end if;

  update public.workspace_members
  set role = normalized_role,
      designation_id = new_designation_id,
      status = normalized_status,
      deactivated_at = case
        when normalized_status = 'deactivated' then coalesce(deactivated_at, now())
        else null
      end,
      deactivated_by = case
        when normalized_status = 'deactivated' then auth.uid()
        else null
      end
  where workspace_id = target_workspace_id
    and user_id = member_user_id;

  delete from public.workspace_member_permissions
  where workspace_id = target_workspace_id
    and user_id = member_user_id;

  insert into public.workspace_member_permissions (
    workspace_id, user_id, permission_key, can_view, can_edit
  )
  select
    target_workspace_id,
    member_user_id,
    entry.key,
    coalesce((entry.value ->> 'can_view')::boolean, false),
    coalesce((entry.value ->> 'can_edit')::boolean, false)
  from jsonb_each(new_permissions) entry
  where coalesce((entry.value ->> 'can_view')::boolean, false)
     or coalesce((entry.value ->> 'can_edit')::boolean, false);

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'workspace_member',
    member_user_id,
    jsonb_build_object(
      'previous_role', previous_role,
      'new_role', normalized_role,
      'previous_status', previous_status,
      'new_status', normalized_status,
      'designation_id', new_designation_id,
      'permissions', new_permissions
    )
  );
end;
$$;

create or replace function public.revoke_workspace_invitation(
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  perform public.require_mfa();

  select invitation.workspace_id
    into target_workspace_id
  from public.workspace_invitations invitation
  join public.workspaces workspace on workspace.id = invitation.workspace_id
  where invitation.id = target_invitation_id
    and workspace.owner_id = auth.uid()
    and invitation.status = 'pending'
  for update;

  if target_workspace_id is null then
    raise exception 'Pending invitation was not found';
  end if;

  update public.workspace_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = target_invitation_id;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id
  )
  values (
    target_workspace_id,
    auth.uid(),
    'revoke',
    'workspace_invitation',
    target_invitation_id
  );
end;
$$;

revoke all on function public.validate_permission_snapshot(jsonb)
from public, anon, authenticated;
revoke all on function public.list_workspace_access(uuid)
from public, anon, authenticated;
revoke all on function public.list_workspace_invitations(uuid)
from public, anon, authenticated;
revoke all on function public.create_workspace_designation(uuid, text)
from public, anon, authenticated;
revoke all on function public.create_workspace_invitation(uuid, text, uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.attach_workspace_invitation_auth_user(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.accept_workspace_invitation(uuid)
from public, anon, authenticated;
revoke all on function public.update_workspace_member_access(uuid, uuid, text, uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.revoke_workspace_invitation(uuid)
from public, anon, authenticated;

grant execute on function public.list_workspace_access(uuid) to authenticated;
grant execute on function public.list_workspace_invitations(uuid) to authenticated;
grant execute on function public.create_workspace_designation(uuid, text) to authenticated;
grant execute on function public.create_workspace_invitation(uuid, text, uuid, text, jsonb) to authenticated;
grant execute on function public.attach_workspace_invitation_auth_user(uuid, uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
grant execute on function public.update_workspace_member_access(uuid, uuid, text, uuid, text, jsonb) to authenticated;
grant execute on function public.revoke_workspace_invitation(uuid) to authenticated;
