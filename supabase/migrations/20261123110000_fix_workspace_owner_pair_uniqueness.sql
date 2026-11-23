-- A workspace owner is unique by the normalized email-and-phone pair.
-- Matching only one contact field must not block a new workspace.
create or replace function public.prevent_duplicate_workspace_owner_contacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.owner_email, '')));
  normalized_contact text := regexp_replace(trim(coalesce(new.owner_contact_number, '')), '[^0-9]', '', 'g');
begin
  if nullif(normalized_email, '') is not null
     and nullif(normalized_contact, '') is not null then
    perform pg_advisory_xact_lock(hashtextextended('workspace-owner:' || normalized_email || ':' || normalized_contact, 0));
    if exists (
      select 1
      from public.workspaces workspace
      where workspace.id is distinct from new.id
        and lower(trim(workspace.owner_email)) = normalized_email
        and regexp_replace(trim(workspace.owner_contact_number), '[^0-9]', '', 'g') = normalized_contact
    ) then
      raise exception 'A workspace already exists with this email and phone number.' using errcode = '23505';
    end if;
  end if;

  new.owner_email := normalized_email;
  new.owner_contact_number := normalized_contact;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_workspace_owner_contacts on public.workspaces;
create trigger prevent_duplicate_workspace_owner_contacts
before insert or update of owner_email, owner_contact_number on public.workspaces
for each row execute function public.prevent_duplicate_workspace_owner_contacts();

create or replace function public.create_workspace(
  workspace_name text,
  business_name text,
  owner_first_name text default '',
  owner_second_name text default '',
  owner_email text default '',
  owner_contact_number text default '',
  owner_gender text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  normalized_email text := lower(trim(coalesce(owner_email, '')));
  normalized_contact text := regexp_replace(trim(coalesce(owner_contact_number, '')), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if nullif(trim(workspace_name), '') is null
     or nullif(trim(business_name), '') is null then
    raise exception 'Workspace and business names are required';
  end if;

  if nullif(normalized_email, '') is not null
     and nullif(normalized_contact, '') is not null
     and exists (
       select 1
       from public.workspaces workspace
       where lower(trim(workspace.owner_email)) = normalized_email
         and regexp_replace(trim(workspace.owner_contact_number), '[^0-9]', '', 'g') = normalized_contact
     ) then
    raise exception 'A workspace already exists with this email and phone number.' using errcode = '23505';
  end if;

  insert into public.workspaces (
    name,
    business_name,
    owner_id,
    owner_first_name,
    owner_second_name,
    owner_email,
    owner_contact_number,
    owner_gender
  )
  values (
    trim(workspace_name),
    trim(business_name),
    auth.uid(),
    trim(owner_first_name),
    trim(owner_second_name),
    normalized_email,
    normalized_contact,
    trim(owner_gender)
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text, text, text, text, text) from public;
grant execute on function public.create_workspace(text, text, text, text, text, text, text) to authenticated;
