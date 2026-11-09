'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

import { type CapitalAccount, type CapitalEntry, type Customer, type Expense, type Product, type SaleLineItem, type Supplier, type SupplierPayment, type Transaction } from '../erp-data'

export type RemoteStoreData = {
  products: Product[]
  transactions: Transaction[]
  customers: Customer[]
  suppliers: Supplier[]
  supplierPayments: SupplierPayment[]
  expenses: Expense[]
  expenseCategories: string[]
  capitalAccounts: CapitalAccount[]
  capitalEntries: CapitalEntry[]
}

export type RemoteResource = keyof RemoteStoreData
type ResourceResult<R extends RemoteResource> = { data: RemoteStoreData[R] | null; error?: string }
export type TransactionPageFilters = { page: number; pageSize: number; month?: string; search?: string }
export type RemotePage<T> = { items: T[]; total: number; page: number; pageSize: number; hasNextPage: boolean }

type DbRow = Record<string, unknown>
type WorkspaceRowsResult = { data: DbRow[] | null; error?: string }
const READ_PAGE_SIZE = 500
const READ_MAX_PAGES = 100

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function optionalText(value: unknown) {
  const result = text(value).trim()
  return result || undefined
}

function number(value: unknown, fallback = 0) {
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : fallback
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  return number(value)
}

function date(value: unknown) {
  const result = text(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : new Date().toISOString().slice(0, 10)
}

function month(value: string) {
  return value.slice(0, 7)
}

function rows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter((item): item is DbRow => Boolean(item && typeof item === 'object')) : []
}

async function fetchWorkspaceRows(
  supabase: SupabaseClient,
  table: string,
  selection: string,
  workspaceId: string,
  orderColumn?: string,
  ascending = false,
): Promise<WorkspaceRowsResult> {
  const collected: DbRow[] = []
  for (let page = 0; page < READ_MAX_PAGES; page += 1) {
    const query = supabase
      .from(table)
      .select(selection)
      .eq('workspace_id', workspaceId)
      .range(page * READ_PAGE_SIZE, (page + 1) * READ_PAGE_SIZE - 1)
    const result = orderColumn
      ? await query.order(orderColumn, { ascending })
      : await query
    if (result.error) return { data: null, error: result.error.message }
    const batch = rows(result.data)
    collected.push(...batch)
    if (batch.length < READ_PAGE_SIZE) return { data: collected }
  }
  return { data: null, error: `The ${table} dataset exceeds the safe read limit.` }
}

function mapProduct(row: DbRow): Product {
  return {
    id: text(row.id),
    name: text(row.name),
    sku: text(row.sku),
    brand: text(row.brand, 'other'),
    model: text(row.model, text(row.name)),
    color: text(row.color, 'Unspecified'),
    description: optionalText(row.description),
    imageUrl: optionalText(row.image_url),
    imageSource: row.image_source === 'catalog' ? 'catalog' : undefined,
    category: text(row.category),
    costPrice: number(row.cost_price),
    sellingPrice: number(row.selling_price),
    inStockQuantity: number(row.stock_quantity),
    reorderLevel: number(row.reorder_level),
    vendorName: text(row.vendor_name, 'Unassigned'),
    vendorContactNumber: optionalText(row.vendor_contact_number),
    vendorCompany: optionalText(row.vendor_company),
    sold: number(row.sold_quantity),
    received: number(row.received_quantity),
  }
}

function mapCustomer(row: DbRow): Customer {
  return {
    id: text(row.id),
    name: text(row.name),
    contactNumber: text(row.contact_number),
    gender: optionalText(row.gender),
    cnicNumber: optionalText(row.cnic_number),
    code: text(row.code),
    createdAt: text(row.created_at, new Date().toISOString()),
  }
}

function mapSupplier(row: DbRow): Supplier {
  return {
    id: text(row.id),
    name: text(row.name),
    contactNumber: text(row.contact_number),
    company: text(row.company),
    cnicNumber: optionalText(row.cnic_number),
    openingBalance: number(row.opening_balance),
    createdAt: text(row.created_at, new Date().toISOString()),
  }
}

function mapSaleItem(row: DbRow): SaleLineItem {
  return {
    productId: text(row.product_id),
    name: text(row.name_snapshot),
    sku: text(row.sku_snapshot),
    color: optionalText(row.color_snapshot),
    quantity: number(row.quantity),
    unitSellingPrice: number(row.unit_selling_price),
    unitCost: number(row.unit_cost),
    discount: number(row.discount),
    amount: number(row.amount),
    profit: number(row.profit),
  }
}

function mapTransaction(row: DbRow, saleItemsByTransaction: Map<string, SaleLineItem[]>): Transaction {
  const occurredOn = date(row.occurred_on)
  const transactionType = text(row.transaction_type) as Transaction['type']
  const transaction: Transaction = {
    id: text(row.id),
    type: transactionType === 'purchase' || transactionType === 'transfer' ? transactionType : 'sale',
    name: text(row.name),
    party: text(row.party),
    quantity: number(row.quantity),
    amount: number(row.amount),
    profit: optionalNumber(row.profit),
    time: text(row.time_label, 'Recorded'),
    date: occurredOn,
    month: month(occurredOn),
    customerId: optionalText(row.customer_id),
    supplierId: optionalText(row.supplier_id),
    customerContactNumber: optionalText(row.customer_contact_number),
    customerCode: optionalText(row.customer_code),
    supplierContactNumber: optionalText(row.supplier_contact_number),
    supplierCompany: optionalText(row.supplier_company),
    fromEntity: optionalText(row.from_entity),
    toEntity: optionalText(row.to_entity),
    transferKind: optionalText(row.transfer_kind) as Transaction['transferKind'],
    paidAmount: optionalNumber(row.paid_amount),
    outstandingAmount: optionalNumber(row.outstanding_amount),
    productId: optionalText(row.product_id),
    unitCost: optionalNumber(row.unit_cost),
    source: optionalText(row.source) as Transaction['source'],
    exchangeId: optionalText(row.exchange_id),
    tradeInCredit: optionalNumber(row.trade_in_credit),
    amountDue: optionalNumber(row.amount_due),
    invoiceNumber: optionalText(row.invoice_number),
    capitalId: optionalText(row.capital_id),
    fundingSource: optionalText(row.funding_source) as Transaction['fundingSource'],
    createdAt: text(row.created_at, `${occurredOn}T00:00:00.000Z`),
  }
  const items = saleItemsByTransaction.get(transaction.id)
  if (items?.length) transaction.items = items
  return transaction
}

function mapSupplierPayment(row: DbRow): SupplierPayment {
  const occurredOn = date(row.occurred_on)
  return {
    id: text(row.id),
    supplierId: text(row.supplier_id),
    amount: number(row.amount),
    note: optionalText(row.note),
    date: occurredOn,
    time: text(row.created_at, 'Recorded'),
    createdAt: text(row.created_at, `${occurredOn}T00:00:00.000Z`),
    capitalId: optionalText(row.capital_id),
  }
}

function mapExpense(row: DbRow): Expense {
  const occurredOn = date(row.occurred_on)
  return {
    id: text(row.id),
    invoiceNumber: optionalText(row.invoice_number),
    category: text(row.category),
    description: text(row.description),
    amount: number(row.amount),
    date: occurredOn,
    month: month(occurredOn),
    paymentMethod: optionalText(row.payment_method),
    note: optionalText(row.note),
    createdAt: text(row.created_at, `${occurredOn}T00:00:00.000Z`),
  }
}

function mapCapitalAccount(row: DbRow): CapitalAccount {
  return {
    id: text(row.id),
    name: text(row.name),
    ownerName: optionalText(row.owner_name),
    createdAt: text(row.created_at, new Date().toISOString()),
  }
}

function mapCapitalEntry(row: DbRow): CapitalEntry {
  const occurredOn = date(row.occurred_on)
  return {
    id: text(row.id),
    capitalId: text(row.capital_id),
    type: text(row.entry_type) as CapitalEntry['type'],
    amount: number(row.amount),
    date: occurredOn,
    month: month(occurredOn),
    note: optionalText(row.note),
    createdAt: text(row.created_at, `${occurredOn}T00:00:00.000Z`),
  }
}

function mapRows<T>(result: WorkspaceRowsResult, mapper: (row: DbRow) => T): { data: T[] | null; error?: string } {
  if (result.error) return { data: null, error: result.error }
  return { data: rows(result.data).map(mapper) }
}

function escapePostgrestSearch(value: string) {
  return value.replace(/[\\%_,().]/g, (character) => `\\${character}`)
}

function nextMonthStart(value: string) {
  const [year, monthNumber] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return undefined
  const next = new Date(Date.UTC(year, monthNumber, 1))
  return next.toISOString().slice(0, 10)
}

export async function loadSupabaseTransactionPage(
  supabase: SupabaseClient,
  workspaceId: string,
  filters: TransactionPageFilters,
): Promise<{ data: RemotePage<Transaction> | null; error?: string }> {
  const page = Math.max(1, Math.floor(filters.page))
  const pageSize = Math.min(100, Math.max(5, Math.floor(filters.pageSize)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  const selectedMonth = filters.month?.trim()
  if (selectedMonth && selectedMonth !== 'all') {
    const monthEnd = nextMonthStart(selectedMonth)
    if (/^\d{4}-\d{2}$/.test(selectedMonth) && monthEnd) query.gte('occurred_on', `${selectedMonth}-01`).lt('occurred_on', monthEnd)
  }

  const search = filters.search?.trim()
  if (search) {
    const escaped = escapePostgrestSearch(search)
    query.or(`name.ilike.%${escaped}%,party.ilike.%${escaped}%,transaction_type.ilike.%${escaped}%,source.ilike.%${escaped}%`)
  }

  const transactionResult = await query
  if (transactionResult.error) return { data: null, error: transactionResult.error.message }
  const transactionRows = rows(transactionResult.data)
  const transactionIds = transactionRows.map((row) => text(row.id)).filter(Boolean)
  const saleItemsByTransaction = new Map<string, SaleLineItem[]>()

  if (transactionIds.length) {
    const saleItemsResult = await supabase
      .from('sale_items')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('transaction_id', transactionIds)
      .order('line_number', { ascending: true })
    if (saleItemsResult.error) return { data: null, error: saleItemsResult.error.message }
    for (const row of rows(saleItemsResult.data)) {
      const transactionId = text(row.transaction_id)
      saleItemsByTransaction.set(transactionId, [...(saleItemsByTransaction.get(transactionId) ?? []), mapSaleItem(row)])
    }
  }

  const total = transactionResult.count ?? 0
  return {
    data: {
      items: transactionRows.map((row) => mapTransaction(row, saleItemsByTransaction)),
      total,
      page,
      pageSize,
      hasNextPage: from + transactionRows.length < total,
    },
  }
}

export async function loadSupabaseResource<R extends RemoteResource>(supabase: SupabaseClient, workspaceId: string, resource: R): Promise<ResourceResult<R>> {
  switch (resource) {
    case 'products':
      return mapRows(await fetchWorkspaceRows(supabase, 'products', '*', workspaceId, 'created_at'), mapProduct) as ResourceResult<R>
    case 'customers':
      return mapRows(await fetchWorkspaceRows(supabase, 'customers', '*', workspaceId, 'created_at'), mapCustomer) as ResourceResult<R>
    case 'suppliers':
      return mapRows(await fetchWorkspaceRows(supabase, 'suppliers', '*', workspaceId, 'created_at'), mapSupplier) as ResourceResult<R>
    case 'transactions': {
      const [transactionRows, saleItemRows] = await Promise.all([
        fetchWorkspaceRows(supabase, 'transactions', '*', workspaceId, 'occurred_on'),
        fetchWorkspaceRows(supabase, 'sale_items', '*', workspaceId, 'id'),
      ])
      if (transactionRows.error) return { data: null, error: transactionRows.error } as ResourceResult<R>
      if (saleItemRows.error) return { data: null, error: saleItemRows.error } as ResourceResult<R>
      const saleItemsByTransaction = new Map<string, SaleLineItem[]>()
      for (const row of rows(saleItemRows.data)) {
        const transactionId = text(row.transaction_id)
        saleItemsByTransaction.set(transactionId, [...(saleItemsByTransaction.get(transactionId) ?? []), mapSaleItem(row)])
      }
      return { data: rows(transactionRows.data).map((row) => mapTransaction(row, saleItemsByTransaction)) } as ResourceResult<R>
    }
    case 'supplierPayments':
      return mapRows(await fetchWorkspaceRows(supabase, 'supplier_payments', '*', workspaceId, 'occurred_on'), mapSupplierPayment) as ResourceResult<R>
    case 'expenses':
      return mapRows(await fetchWorkspaceRows(supabase, 'expenses', '*', workspaceId, 'occurred_on'), mapExpense) as ResourceResult<R>
    case 'expenseCategories': {
      const result = await fetchWorkspaceRows(supabase, 'expense_categories', 'name', workspaceId, 'name', true)
      if (result.error) return { data: null, error: result.error } as ResourceResult<R>
      return { data: Array.from(new Set(rows(result.data).map((row) => text(row.name)).filter(Boolean))) } as ResourceResult<R>
    }
    case 'capitalAccounts':
      return mapRows(await fetchWorkspaceRows(supabase, 'capital_accounts', '*', workspaceId, 'created_at', true), mapCapitalAccount) as ResourceResult<R>
    case 'capitalEntries':
      return mapRows(await fetchWorkspaceRows(supabase, 'capital_entries', '*', workspaceId, 'occurred_on'), mapCapitalEntry) as ResourceResult<R>
  }
}

export async function loadSupabaseStoreData(supabase: SupabaseClient, workspaceId: string): Promise<{ data: RemoteStoreData | null; error?: string }> {
  const [products, customers, suppliers, transactions, supplierPayments, expenses, expenseCategories, capitalAccounts, capitalEntries] = await Promise.all([
    loadSupabaseResource(supabase, workspaceId, 'products'),
    loadSupabaseResource(supabase, workspaceId, 'customers'),
    loadSupabaseResource(supabase, workspaceId, 'suppliers'),
    loadSupabaseResource(supabase, workspaceId, 'transactions'),
    loadSupabaseResource(supabase, workspaceId, 'supplierPayments'),
    loadSupabaseResource(supabase, workspaceId, 'expenses'),
    loadSupabaseResource(supabase, workspaceId, 'expenseCategories'),
    loadSupabaseResource(supabase, workspaceId, 'capitalAccounts'),
    loadSupabaseResource(supabase, workspaceId, 'capitalEntries'),
  ])
  const failed = [products, customers, suppliers, transactions, supplierPayments, expenses, expenseCategories, capitalAccounts, capitalEntries].find((result) => result.error)
  if (failed?.error) return { data: null, error: failed.error }
  return {
    data: {
      products: products.data ?? [],
      customers: customers.data ?? [],
      suppliers: suppliers.data ?? [],
      transactions: transactions.data ?? [],
      supplierPayments: supplierPayments.data ?? [],
      expenses: expenses.data ?? [],
      expenseCategories: expenseCategories.data ?? [],
      capitalAccounts: capitalAccounts.data ?? [],
      capitalEntries: capitalEntries.data ?? [],
    },
  }
}
