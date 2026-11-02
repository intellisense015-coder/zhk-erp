-- Member profile fields for the production invitation flow.
-- Designations remain available in the database for compatibility, but the
-- owner UI no longer depends on them.

alter table public.workspace_members
  add column if not exists member_name text not null default '',
  add column if not exists contact_number text not null default '';

alter table public.workspace_invitations
  add column if not exists member_name text not null default '',
  add column if not exists contact_number text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_member_name_length_check'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_member_name_length_check
      check (length(member_name) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_contact_number_length_check'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_contact_number_length_check
      check (length(contact_number) <= 32);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_invitations_member_name_length_check'
      and conrelid = 'public.workspace_invitations'::regclass
  ) then
    alter table public.workspace_invitations
      add constraint workspace_invitations_member_name_length_check
      check (length(member_name) = 0 or length(member_name) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_invitations_contact_number_length_check'
      and conrelid = 'public.workspace_invitations'::regclass
  ) then
    alter table public.workspace_invitations
      add constraint workspace_invitations_contact_number_length_check
      check (length(contact_number) = 0 or length(contact_number) between 7 and 32);
  end if;
end;
$$;

create or replace function public.create_workspace_invitation_with_profile(
  target_workspace_id uuid,
  invitation_email text,
  invitation_member_name text,
  invitation_contact_number text,
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
  normalized_name text := trim(invitation_member_name);
  normalized_contact text := trim(invitation_contact_number);
begin
  if length(normalized_name) not between 1 and 120 then
    raise exception 'Member name must contain between 1 and 120 characters';
  end if;

  if length(normalized_contact) not between 7 and 32
     or normalized_contact !~ '^[+()0-9 -]+$' then
    raise exception 'Enter a valid contact number';
  end if;

  new_invitation_id := public.create_workspace_invitation(
    target_workspace_id,
    invitation_email,
    null,
    target_role,
    target_permissions
  );

  update public.workspace_invitations
  set member_name = normalized_name,
      contact_number = normalized_contact,
      updated_at = now()
  where id = new_invitation_id;

  insert into public.audit_logs (
    workspace_id, user_id, action, entity_type, entity_id, payload
  )
  values (
    target_workspace_id,
    auth.uid(),
    'update',
    'workspace_invitation',
    new_invitation_id,
    jsonb_build_object(
      'member_name', normalized_name,
      'contact_number', normalized_contact
    )
  );

  return new_invitation_id;
end;
$$;

create or replace function public.list_workspace_access_with_profile(target_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  member_name text,
  contact_number text,
  role text,
  status text,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_mfa();

  if not exists (
    select 1 from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can view access settings';
  end if;

  return query
  select
    member.user_id::uuid,
    coalesce(auth_user.email::text, ''::text)::text,
    member.member_name::text,
    member.contact_number::text,
    member.role::text,
    member.status::text,
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
  where member.workspace_id = target_workspace_id
  order by case member.role
    when 'owner' then 1
    when 'manager' then 2
    else 3
  end, lower(coalesce(auth_user.email, ''));
end;
$$;

create or replace function public.list_workspace_invitations_with_profile(target_workspace_id uuid)
returns table (
  invitation_id uuid,
  email text,
  member_name text,
  contact_number text,
  role text,
  status text,
  permission_snapshot jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_mfa();

  if not exists (
    select 1 from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can view invitations';
  end if;

  return query
  select
    invitation.id::uuid,
    invitation.email::text,
    invitation.member_name::text,
    invitation.contact_number::text,
    invitation.role::text,
    (case
      when invitation.status = 'pending'
       and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end)::text,
    invitation.permission_snapshot::jsonb,
    invitation.expires_at::timestamptz
  from public.workspace_invitations invitation
  where invitation.workspace_id = target_workspace_id
  order by invitation.created_at desc;
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

  select invitation_record.* into invitation
  from public.workspace_invitations invitation_record
  where invitation_record.id = target_invitation_id
  for update;

  if not found then raise exception 'Invitation was not found'; end if;
  if invitation.status <> 'pending' then raise exception 'This invitation is no longer pending'; end if;

  if invitation.expires_at <= now() then
    update public.workspace_invitations set status = 'expired', updated_at = now() where id = target_invitation_id;
    raise exception 'This invitation has expired';
  end if;

  select lower(auth_user.email) into auth_email
  from auth.users auth_user where auth_user.id = auth.uid();

  if invitation.auth_user_id is not null and invitation.auth_user_id <> auth.uid() then
    raise exception 'This invitation belongs to another account';
  end if;
  if invitation.auth_user_id is null and auth_email is distinct from lower(invitation.email) then
    raise exception 'Sign in with the invited email address';
  end if;

  select member.status into existing_status
  from public.workspace_members member
  where member.workspace_id = invitation.workspace_id and member.user_id = auth.uid()
  for update;

  if existing_status = 'active' then
    raise exception 'This account is already an active workspace member';
  elsif existing_status = 'deactivated' then
    update public.workspace_members
    set role = invitation.role,
        member_name = invitation.member_name,
        contact_number = invitation.contact_number,
        status = 'active',
        accepted_at = now(),
        deactivated_at = null,
        deactivated_by = null
    where workspace_id = invitation.workspace_id and user_id = auth.uid();
  else
    insert into public.workspace_members (
      workspace_id, user_id, role, member_name, contact_number,
      status, invited_at, accepted_at
    )
    values (
      invitation.workspace_id, auth.uid(), invitation.role,
      invitation.member_name, invitation.contact_number,
      'active', invitation.invited_at, now()
    );
  end if;

  delete from public.workspace_member_permissions
  where workspace_id = invitation.workspace_id and user_id = auth.uid();

  insert into public.workspace_member_permissions (
    workspace_id, user_id, permission_key, can_view, can_edit
  )
  select invitation.workspace_id, auth.uid(), entry.key,
    coalesce((entry.value ->> 'can_view')::boolean, false),
    coalesce((entry.value ->> 'can_edit')::boolean, false)
  from jsonb_each(invitation.permission_snapshot) entry
  where coalesce((entry.value ->> 'can_view')::boolean, false)
     or coalesce((entry.value ->> 'can_edit')::boolean, false);

  update public.workspace_invitations
  set status = 'accepted', auth_user_id = auth.uid(), accepted_at = now(), updated_at = now()
  where id = target_invitation_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    invitation.workspace_id, auth.uid(), 'accept', 'workspace_invitation', target_invitation_id,
    jsonb_build_object('member_user_id', auth.uid())
  );

  return invitation.workspace_id;
end;
$$;

revoke all on function public.create_workspace_invitation_with_profile(uuid, text, text, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.list_workspace_access_with_profile(uuid)
from public, anon, authenticated;
revoke all on function public.list_workspace_invitations_with_profile(uuid)
from public, anon, authenticated;
grant execute on function public.create_workspace_invitation_with_profile(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.list_workspace_access_with_profile(uuid) to authenticated;
grant execute on function public.list_workspace_invitations_with_profile(uuid) to authenticated;
