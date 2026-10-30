-- Solexa / ZHK Mobiles initial Supabase schema.
--
-- This migration defines the durable model only. The application still uses
-- localStorage until the data-access layer and import workflow are tested.

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  owner_first_name text not null default '',
  owner_second_name text not null default '',
  owner_email text not null default '',
  owner_contact_number text not null default '',
  owner_gender text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  sku text not null,
  brand text not null default '',
  model text not null default '',
  color text not null default '',
  description text,
  image_url text,
  image_source text check (image_source is null or image_source = 'catalog'),
  category text not null,
  cost_price numeric(14, 2) not null check (cost_price >= 0),
  selling_price numeric(14, 2) not null check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  vendor_name text not null default '',
  vendor_contact_number text not null default '',
  vendor_company text not null default '',
  sold_quantity integer not null default 0 check (sold_quantity >= 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku)
);

create unique index products_workspace_name_color_key
  on public.products (workspace_id, lower(name), lower(color));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  contact_number text not null,
  gender text not null default '',
  cnic_number text not null default '',
  code text not null,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_number),
  unique (workspace_id, code)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  contact_number text not null,
  company text not null default '',
  cnic_number text not null default '',
  opening_balance numeric(14, 2) not null default 0 check (opening_balance >= 0),
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_number)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.capital_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  owner_name text not null default '',
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.capital_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  capital_id uuid not null references public.capital_accounts(id) on delete restrict,
  entry_type text not null check (entry_type in ('contribution', 'withdrawal')),
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  legacy_id text,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('sale', 'purchase', 'transfer')),
  invoice_number text,
  name text not null,
  party text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  profit numeric(14, 2),
  time_label text not null default '',
  occurred_on date not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_contact_number text,
  customer_code text,
  supplier_contact_number text,
  supplier_company text,
  from_entity text,
  to_entity text,
  transfer_kind text check (transfer_kind is null or transfer_kind in ('supplier-to-customer', 'customer-to-customer')),
  paid_amount numeric(14, 2) check (paid_amount is null or paid_amount >= 0),
  outstanding_amount numeric(14, 2) check (outstanding_amount is null or outstanding_amount >= 0),
  product_id uuid references public.products(id) on delete set null,
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  source text check (source is null or source in ('supplier', 'customer-trade-in', 'exchange')),
  exchange_id text,
  trade_in_credit numeric(14, 2) check (trade_in_credit is null or trade_in_credit >= 0),
  amount_due numeric(14, 2),
  capital_id uuid references public.capital_accounts(id) on delete set null,
  funding_source text check (funding_source is null or funding_source in ('capital', 'supplier-credit', 'other')),
  legacy_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_id uuid not null references public.products(id) on delete restrict,
  name_snapshot text not null,
  sku_snapshot text not null default '',
  color_snapshot text not null default '',
  quantity integer not null check (quantity > 0),
  unit_selling_price numeric(14, 2) not null check (unit_selling_price > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  amount numeric(14, 2) not null check (amount >= 0),
  profit numeric(14, 2) not null,
  unique (transaction_id, line_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_id uuid not null references public.products(id) on delete restrict,
  name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2) not null check (unit_cost > 0),
  amount numeric(14, 2) not null check (amount >= 0),
  unique (transaction_id, line_number)
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_on date not null default current_date,
  capital_id uuid references public.capital_accounts(id) on delete set null,
  purchase_transaction_id uuid references public.transactions(id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_number text,
  category text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  payment_method text,
  note text,
  legacy_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  movement_type text not null check (movement_type in ('purchase', 'sale', 'trade-in', 'adjustment')),
  quantity_delta integer not null check (quantity_delta <> 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.invoice_sequences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_date date not null,
  last_sequence integer not null default 0 check (last_sequence >= 0),
  primary key (workspace_id, invoice_date)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index transactions_workspace_date_idx
  on public.transactions (workspace_id, occurred_on desc);
create index transactions_workspace_type_date_idx
  on public.transactions (workspace_id, transaction_type, occurred_on desc);
create index sale_items_product_idx on public.sale_items (workspace_id, product_id);
create index purchase_items_product_idx on public.purchase_items (workspace_id, product_id);
create index supplier_payments_supplier_idx on public.supplier_payments (workspace_id, supplier_id, occurred_on desc);
create index expenses_workspace_date_idx on public.expenses (workspace_id, occurred_on desc);
create index stock_movements_product_idx on public.stock_movements (workspace_id, product_id, occurred_on desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger capital_accounts_set_updated_at
before update on public.capital_accounts
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

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
  limit 1;
$$;

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
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if nullif(trim(workspace_name), '') is null
     or nullif(trim(business_name), '') is null then
    raise exception 'Workspace and business names are required';
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
    trim(owner_email),
    trim(owner_contact_number),
    trim(owner_gender)
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

create or replace function public.next_invoice_number(target_workspace_id uuid, invoice_date date)
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
  on conflict (workspace_id, invoice_date)
  do update set last_sequence = public.invoice_sequences.last_sequence + 1
  returning last_sequence into next_sequence;

  return format(
    'ZHK-%s%s',
    to_char(invoice_date, 'YYMMDD'),
    case when next_sequence = 1 then '' else '-' || lpad(next_sequence::text, 2, '0') end
  );
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
revoke all on function public.create_workspace(text, text, text, text, text, text, text) from public;
revoke all on function public.next_invoice_number(uuid, date) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.create_workspace(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.next_invoice_number(uuid, date) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.capital_accounts enable row level security;
alter table public.capital_entries enable row level security;
alter table public.transactions enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_movements enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.audit_logs enable row level security;

create policy workspaces_member_read on public.workspaces
for select to authenticated
using (owner_id = auth.uid() or public.is_workspace_member(id));

create policy workspaces_owner_update on public.workspaces
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy workspace_members_member_read on public.workspace_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_member(workspace_id)
);

create policy products_member_read on public.products
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy customers_member_read on public.customers
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy suppliers_member_read on public.suppliers
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy expense_categories_member_read on public.expense_categories
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy capital_accounts_member_read on public.capital_accounts
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy capital_entries_member_read on public.capital_entries
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy transactions_member_read on public.transactions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sale_items_member_read on public.sale_items
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy purchase_items_member_read on public.purchase_items
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy supplier_payments_member_read on public.supplier_payments
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy expenses_member_read on public.expenses
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy stock_movements_member_read on public.stock_movements
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy invoice_sequences_member_read on public.invoice_sequences
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy audit_logs_member_read on public.audit_logs
for select to authenticated using (public.is_workspace_member(workspace_id));
