-- Secure owner-only workspace profile persistence.
-- The browser may cache the profile locally, but Supabase remains authoritative.

create or replace function public.update_workspace_profile(
  target_workspace_id uuid,
  profile_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_business_name text := nullif(trim(coalesce(profile_payload->>'business_name', '')), '');
  requested_first_name text := nullif(trim(coalesce(profile_payload->>'owner_first_name', '')), '');
  requested_second_name text := nullif(trim(coalesce(profile_payload->>'owner_second_name', '')), '');
  requested_email text := lower(trim(coalesce(profile_payload->>'owner_email', '')));
  requested_contact text := regexp_replace(trim(coalesce(profile_payload->>'owner_contact_number', '')), '[^0-9]', '', 'g');
  requested_gender text := trim(coalesce(profile_payload->>'owner_gender', ''));
  workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if requested_business_name is null or length(requested_business_name) > 200 then
    raise exception 'Business name is required and must be 200 characters or less';
  end if;
  if requested_first_name is null or length(requested_first_name) > 100 then
    raise exception 'Owner first name is required and must be 100 characters or less';
  end if;
  if requested_second_name is null or length(requested_second_name) > 100 then
    raise exception 'Owner second name is required and must be 100 characters or less';
  end if;
  if length(requested_email) > 254 or requested_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Business email is invalid';
  end if;
  if requested_contact !~ '^[0-9]{7,15}$' then
    raise exception 'Contact number is invalid';
  end if;
  if requested_gender not in ('Male', 'Female', 'Other', 'Prefer not to say') then
    raise exception 'Gender selection is invalid';
  end if;

  select id into workspace_id
  from public.workspaces
  where id = target_workspace_id
    and owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'Only the workspace owner can update business settings';
  end if;

  update public.workspaces
  set business_name = requested_business_name,
      owner_first_name = requested_first_name,
      owner_second_name = requested_second_name,
      owner_email = requested_email,
      owner_contact_number = requested_contact,
      owner_gender = requested_gender,
      updated_at = now()
  where id = workspace_id;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (
    workspace_id,
    auth.uid(),
    'update',
    'workspace_profile',
    workspace_id,
    jsonb_build_object(
      'business_name', requested_business_name,
      'owner_first_name', requested_first_name,
      'owner_second_name', requested_second_name,
      'owner_email', requested_email,
      'owner_contact_number', requested_contact,
      'owner_gender', requested_gender
    )
  );

  return workspace_id;
end;
$$;

revoke all on function public.update_workspace_profile(uuid, jsonb) from public, anon;
grant execute on function public.update_workspace_profile(uuid, jsonb) to authenticated;
