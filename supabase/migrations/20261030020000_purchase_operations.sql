-- Secure purchase and stock-entry operation.
-- The browser calls this RPC instead of writing purchase-related tables directly.

create or replace function public.record_purchase(
  target_workspace_id uuid,
  purchase_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id uuid := nullif(purchase_payload->>'product_id', '')::uuid;
  requested_supplier_id uuid := nullif(purchase_payload->>'supplier_id', '')::uuid;
  requested_capital_id uuid := nullif(purchase_payload->>'capital_id', '')::uuid;
  purchase_quantity integer := coalesce(nullif(purchase_payload->>'quantity', '')::integer, 0);
  purchase_unit_cost numeric := coalesce(nullif(purchase_payload->>'unit_cost', '')::numeric, 0);
  purchase_paid_amount numeric := coalesce(nullif(purchase_payload->>'paid_amount', '')::numeric, 0);
  purchase_funding_source text := coalesce(nullif(trim(purchase_payload->>'funding_source'), ''), 'supplier-credit');
  requested_supplier_name text := nullif(trim(coalesce(purchase_payload->>'vendor_name', '')), '');
  requested_supplier_contact text := regexp_replace(trim(coalesce(purchase_payload->>'supplier_contact_number', '')), '[^0-9]', '', 'g');
  requested_supplier_company text := trim(coalesce(purchase_payload->>'supplier_company', ''));
  product_row public.products%rowtype;
  resolved_supplier_id uuid;
  resolved_supplier_name text;
  resolved_supplier_contact text;
  resolved_supplier_company text;
  purchase_total numeric;
  capital_available numeric;
  invoice_number text;
  transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;

  if public.workspace_role(target_workspace_id) not in ('owner', 'manager') then
    raise exception 'Manager access is required for stock changes';
  end if;

  if product_id is null then
    raise exception 'Choose a product before recording stock';
  end if;
  if purchase_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if purchase_unit_cost <= 0 then
    raise exception 'Unit cost must be greater than zero';
  end if;
  if purchase_paid_amount < 0 then
    raise exception 'Paid amount cannot be negative';
  end if;
  if purchase_funding_source not in ('capital', 'supplier-credit', 'other') then
    raise exception 'Unsupported purchase funding source';
  end if;

  select * into product_row
  from public.products
  where id = product_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'The selected product no longer exists';
  end if;
  if product_row.stock_quantity > 2147483647 - purchase_quantity then
    raise exception 'The resulting stock quantity is too large';
  end if;

  purchase_total := purchase_quantity * purchase_unit_cost;
  if purchase_paid_amount > purchase_total then
    raise exception 'Paid amount cannot exceed the purchase total';
  end if;

  if requested_supplier_id is not null then
    select id, name, contact_number, company
      into resolved_supplier_id, resolved_supplier_name, resolved_supplier_contact, resolved_supplier_company
    from public.suppliers
    where id = requested_supplier_id
      and workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'The selected supplier no longer exists';
    end if;
  else
    if requested_supplier_name is null or requested_supplier_contact = '' then
      raise exception 'Supplier name and contact number are required';
    end if;
    if exists (
      select 1 from public.workspaces
      where id = target_workspace_id
        and regexp_replace(owner_contact_number, '[^0-9]', '', 'g') = requested_supplier_contact
    ) then
      raise exception 'The business owner number cannot be used as a supplier contact';
    end if;
    if exists (
      select 1 from public.customers
      where workspace_id = target_workspace_id
        and contact_number = requested_supplier_contact
    ) then
      raise exception 'This contact number belongs to a customer';
    end if;
    if exists (
      select 1 from public.suppliers
      where workspace_id = target_workspace_id
        and contact_number = requested_supplier_contact
    ) then
      raise exception 'This supplier contact number is already assigned';
    end if;

    insert into public.suppliers (workspace_id, name, contact_number, company)
    values (target_workspace_id, requested_supplier_name, requested_supplier_contact, requested_supplier_company)
    returning id, name, contact_number, company
      into resolved_supplier_id, resolved_supplier_name, resolved_supplier_contact, resolved_supplier_company;
  end if;

  if purchase_funding_source = 'capital' then
    if requested_capital_id is null then
      raise exception 'Choose a capital account for this purchase';
    end if;

    perform 1
    from public.capital_accounts
    where id = requested_capital_id
      and workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'The selected capital account no longer exists';
    end if;

    select coalesce(sum(case when entry_type = 'contribution' then amount else -amount end), 0)
      into capital_available
    from public.capital_entries
    where workspace_id = target_workspace_id
      and capital_id = requested_capital_id;

    capital_available := capital_available
      - coalesce((
        select sum(coalesce(transaction_record.paid_amount, 0))
        from public.transactions transaction_record
        where transaction_record.workspace_id = target_workspace_id
          and transaction_record.transaction_type = 'purchase'
          and transaction_record.capital_id = requested_capital_id
      ), 0)
      - coalesce((
        select sum(payment.amount)
        from public.supplier_payments payment
        where payment.workspace_id = target_workspace_id
          and payment.capital_id = requested_capital_id
          and payment.purchase_transaction_id is null
      ), 0);

    if purchase_paid_amount > capital_available then
      raise exception 'The purchase payment exceeds the available capital';
    end if;
  elsif requested_capital_id is not null then
    raise exception 'A capital account can only be used with business capital funding';
  end if;

  invoice_number := public.next_invoice_number(target_workspace_id, current_date);

  insert into public.transactions (
    workspace_id, transaction_type, invoice_number, name, party, quantity, amount,
    time_label, occurred_on, supplier_id, supplier_contact_number, supplier_company,
    product_id, unit_cost, source, paid_amount, outstanding_amount, capital_id,
    funding_source, created_by
  )
  values (
    target_workspace_id, 'purchase', invoice_number, product_row.name, resolved_supplier_name,
    purchase_quantity, purchase_total, 'Recorded', current_date, resolved_supplier_id,
    resolved_supplier_contact, resolved_supplier_company, product_row.id, purchase_unit_cost,
    'supplier', purchase_paid_amount, purchase_total - purchase_paid_amount,
    case when purchase_funding_source = 'capital' then requested_capital_id else null end,
    purchase_funding_source, auth.uid()
  )
  returning id into transaction_id;

  insert into public.purchase_items (
    workspace_id, transaction_id, line_number, product_id, name_snapshot, quantity, unit_cost, amount
  )
  values (
    target_workspace_id, transaction_id, 1, product_row.id, product_row.name,
    purchase_quantity, purchase_unit_cost, purchase_total
  );

  update public.products
  set stock_quantity = stock_quantity + purchase_quantity,
      received_quantity = received_quantity + purchase_quantity,
      cost_price = purchase_unit_cost,
      vendor_name = resolved_supplier_name,
      vendor_contact_number = resolved_supplier_contact,
      vendor_company = resolved_supplier_company
  where id = product_row.id
    and workspace_id = target_workspace_id;

  insert into public.stock_movements (
    workspace_id, product_id, transaction_id, movement_type, quantity_delta, unit_cost, occurred_on
  )
  values (
    target_workspace_id, product_row.id, transaction_id, 'purchase', purchase_quantity,
    purchase_unit_cost, current_date
  );

  if purchase_paid_amount > 0 then
    insert into public.supplier_payments (
      workspace_id, supplier_id, amount, note, occurred_on, capital_id, purchase_transaction_id
    )
    values (
      target_workspace_id, resolved_supplier_id, purchase_paid_amount, 'Paid with purchase',
      current_date, case when purchase_funding_source = 'capital' then requested_capital_id else null end,
      transaction_id
    );
  end if;

  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, payload)
  values (target_workspace_id, auth.uid(), 'create', 'purchase', transaction_id, purchase_payload);

  return transaction_id;
end;
$$;

revoke all on function public.record_purchase(uuid, jsonb) from public;
grant execute on function public.record_purchase(uuid, jsonb) to authenticated;
