-- Production access-control foundation.
-- This migration is additive: it does not remove existing members or ERP data.

create table if not exists public.permission_catalog (
  permission_key text primary key,
  label text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.permission_catalog (permission_key, label, description, sort_order)
values
  ('dashboard', 'Dashboard', 'View business summaries and recent activity.', 10),
  ('pos', 'Point of sale', 'Create sales, exchanges, and buybacks.', 20),
  ('inventory', 'Inventory', 'View and manage products and stock.', 30),
  ('sales', 'Sales', 'View and manage recorded sales.', 40),
  ('purchases', 'Purchases', 'View and manage supplier purchases.', 50),
  ('customers', 'Customers', 'View and manage customer records.', 60),
  ('suppliers', 'Suppliers', 'View and manage supplier records and payments.', 70),
  ('expenses', 'Expenses', 'View and manage expenses and categories.', 80),
  ('capital', 'Capital', 'View and manage capital accounts and entries.', 90),
  ('transfers', 'Transfers', 'View and record stock transfers.', 100),
  ('reports', 'Reports', 'View business reports and calculations.', 110),
  ('transactions', 'Transactions', 'View financial and stock transaction history.', 120),
  ('invoices', 'Invoices', 'View, print, download, and share invoices.', 130),
  ('settings', 'Business settings', 'View and update the business profile.', 140),
  ('audit_logs', 'Audit log', 'View security and business activity history.', 150),
  ('users', 'Users and permissions', 'Invite members and control their access.', 160)
on conflict (permission_key) do nothing;

alter table public.workspace_members
  add column if not exists designation_id uuid,
  add column if not exists status text not null default 'active',
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references auth.users(id) on delete set null;

update public.workspace_members
set accepted_at = coalesce(accepted_at, created_at)
where accepted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_status_check'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_status_check
      check (status in ('active', 'deactivated'));
  end if;
end;
$$;

create table if not exists public.workspace_designations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists workspace_designations_workspace_name_key
  on public.workspace_designations (workspace_id, lower(name));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_designation_id_fkey'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_designation_id_fkey
      foreign key (designation_id)
      references public.workspace_designations(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.workspace_member_permissions (
  workspace_id uuid not null,
  user_id uuid not null,
  permission_key text not null references public.permission_catalog(permission_key),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, permission_key),
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete cascade,
  check (can_edit = false or can_view = true)
);

create index if not exists workspace_member_permissions_user_lookup
  on public.workspace_member_permissions (workspace_id, user_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  designation_id uuid references public.workspace_designations(id) on delete set null,
  role text not null default 'staff',
  permission_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id),
  auth_user_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('manager', 'staff')),
  check (status in ('pending', 'accepted', 'expired', 'revoked')),
  check (length(trim(email)) between 3 and 320),
  check (jsonb_typeof(permission_snapshot) = 'object')
);

create unique index if not exists workspace_invitations_pending_email_key
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

create index if not exists workspace_invitations_workspace_status_lookup
  on public.workspace_invitations (workspace_id, status, created_at desc);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select member.role
  from public.workspace_members member
  where member.workspace_id = target_workspace_id
    and member.user_id = auth.uid()
    and member.status = 'active'
  limit 1;
$$;

create or replace function public.has_workspace_permission(
  target_workspace_id uuid,
  target_permission_key text,
  requested_action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when not public.is_mfa_verified() then false
    when not public.is_workspace_member(target_workspace_id) then false
    when public.workspace_role(target_workspace_id) = 'owner' then true
    when requested_action not in ('view', 'edit') then false
    else exists (
      select 1
      from public.workspace_member_permissions permission
      where permission.workspace_id = target_workspace_id
        and permission.user_id = auth.uid()
        and permission.permission_key = target_permission_key
        and permission.can_view
        and (requested_action = 'view' or permission.can_edit)
    )
  end;
$$;

drop policy if exists workspace_members_member_read on public.workspace_members;
create policy workspace_members_member_read
on public.workspace_members
for select
to authenticated
using (
  status = 'active'
  and (
    user_id = auth.uid()
    or (
      public.is_workspace_member(workspace_id)
      and public.workspace_role(workspace_id) in ('owner', 'manager')
    )
  )
);

alter table public.permission_catalog enable row level security;
alter table public.workspace_designations enable row level security;
alter table public.workspace_member_permissions enable row level security;
alter table public.workspace_invitations enable row level security;

drop policy if exists permission_catalog_mfa_read on public.permission_catalog;
create policy permission_catalog_mfa_read
on public.permission_catalog
for select
to authenticated
using (public.is_mfa_verified());

drop policy if exists workspace_designations_member_read on public.workspace_designations;
create policy workspace_designations_member_read
on public.workspace_designations
for select
to authenticated
using (
  public.is_mfa_verified()
  and public.is_workspace_member(workspace_id)
);

drop policy if exists workspace_member_permissions_member_read on public.workspace_member_permissions;
create policy workspace_member_permissions_member_read
on public.workspace_member_permissions
for select
to authenticated
using (
  public.is_mfa_verified()
  and public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.workspace_role(workspace_id) = 'owner'
  )
);

drop policy if exists workspace_invitations_owner_read on public.workspace_invitations;
create policy workspace_invitations_owner_read
on public.workspace_invitations
for select
to authenticated
using (
  public.is_mfa_verified()
  and exists (
    select 1
    from public.workspaces workspace
    where workspace.id = workspace_invitations.workspace_id
      and workspace.owner_id = auth.uid()
  )
);

drop policy if exists mfa_required_for_workspace_members on public.workspace_members;
create policy mfa_required_for_workspace_members
on public.workspace_members
as restrictive
for select
to authenticated
using (public.is_mfa_verified());

drop policy if exists mfa_required_for_permission_catalog on public.permission_catalog;
create policy mfa_required_for_permission_catalog
on public.permission_catalog
as restrictive
for select
to authenticated
using (public.is_mfa_verified());

drop policy if exists mfa_required_for_workspace_designations on public.workspace_designations;
create policy mfa_required_for_workspace_designations
on public.workspace_designations
as restrictive
for select
to authenticated
using (public.is_mfa_verified());

drop policy if exists mfa_required_for_workspace_member_permissions on public.workspace_member_permissions;
create policy mfa_required_for_workspace_member_permissions
on public.workspace_member_permissions
as restrictive
for select
to authenticated
using (public.is_mfa_verified());

drop policy if exists mfa_required_for_workspace_invitations on public.workspace_invitations;
create policy mfa_required_for_workspace_invitations
on public.workspace_invitations
as restrictive
for select
to authenticated
using (public.is_mfa_verified());

revoke all on table public.permission_catalog from anon, authenticated;
grant select on table public.permission_catalog to authenticated;

revoke all on table public.workspace_designations from anon, authenticated;
grant select on table public.workspace_designations to authenticated;

revoke all on table public.workspace_member_permissions from anon, authenticated;
grant select on table public.workspace_member_permissions to authenticated;

revoke all on table public.workspace_invitations from anon, authenticated;

revoke all on function public.has_workspace_permission(uuid, text, text) from public, anon, authenticated;
grant execute on function public.has_workspace_permission(uuid, text, text) to authenticated;

revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke all on function public.workspace_role(uuid) from public, anon, authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
