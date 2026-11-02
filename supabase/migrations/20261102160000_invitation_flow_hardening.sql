-- Invitation hardening for the password-first onboarding flow.
-- Never bind a pending invitation to an Auth account with a different email.

create or replace function public.attach_workspace_invitation_auth_user(
  target_invitation_id uuid,
  invited_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_workspace_id uuid;
  invitation_email text;
  invited_user_email text;
begin
  perform public.require_mfa();

  select invitation.workspace_id, lower(trim(invitation.email))
    into invitation_workspace_id, invitation_email
  from public.workspace_invitations invitation
  join public.workspaces workspace on workspace.id = invitation.workspace_id
  where invitation.id = target_invitation_id
    and workspace.owner_id = auth.uid()
    and invitation.status = 'pending'
  for update;

  if invitation_workspace_id is null then
    raise exception 'Pending invitation was not found';
  end if;

  select lower(trim(auth_user.email))
    into invited_user_email
  from auth.users auth_user
  where auth_user.id = invited_auth_user_id;

  if invited_user_email is null then
    raise exception 'The invited Auth user does not exist';
  end if;

  if invited_user_email is distinct from invitation_email then
    raise exception 'The invited Auth user email does not match the invitation';
  end if;

  update public.workspace_invitations invitation
  set auth_user_id = invited_auth_user_id,
      updated_at = now()
  where invitation.id = target_invitation_id;
end;
$$;

revoke all on function public.attach_workspace_invitation_auth_user(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.attach_workspace_invitation_auth_user(uuid, uuid) to authenticated;
