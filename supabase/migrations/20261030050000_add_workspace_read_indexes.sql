-- Support the bounded workspace reads and RLS membership checks used by the
-- application data access layer.

create index if not exists workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id, role);
create index if not exists products_workspace_created_idx
  on public.products (workspace_id, created_at desc);
create index if not exists customers_workspace_created_idx
  on public.customers (workspace_id, created_at desc);
create index if not exists suppliers_workspace_created_idx
  on public.suppliers (workspace_id, created_at desc);
create index if not exists sale_items_transaction_idx
  on public.sale_items (workspace_id, transaction_id, line_number);
create index if not exists purchase_items_transaction_idx
  on public.purchase_items (workspace_id, transaction_id, line_number);
create index if not exists capital_accounts_workspace_created_idx
  on public.capital_accounts (workspace_id, created_at desc);
create index if not exists capital_entries_workspace_date_idx
  on public.capital_entries (workspace_id, occurred_on desc);
