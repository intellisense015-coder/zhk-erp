'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

import { defaultExpenseCategories, type CapitalAccount, type CapitalEntry, type Customer, type Expense, type Product, type SaleLineItem, type Supplier, type SupplierPayment, type Transaction } from '../erp-data'

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

type DbRow = Record<string, unknown>

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

export async function loadSupabaseStoreData(supabase: SupabaseClient, workspaceId: string): Promise<{ data: RemoteStoreData | null; error?: string }> {
  const results = await Promise.all([
    supabase.from('products').select('*').eq('workspace_id', workspaceId),
    supabase.from('customers').select('*').eq('workspace_id', workspaceId),
    supabase.from('suppliers').select('*').eq('workspace_id', workspaceId),
    supabase.from('transactions').select('*').eq('workspace_id', workspaceId).order('occurred_on', { ascending: false }),
    supabase.from('sale_items').select('*').eq('workspace_id', workspaceId),
    supabase.from('supplier_payments').select('*').eq('workspace_id', workspaceId).order('occurred_on', { ascending: false }),
    supabase.from('expenses').select('*').eq('workspace_id', workspaceId).order('occurred_on', { ascending: false }),
    supabase.from('expense_categories').select('name').eq('workspace_id', workspaceId).order('name'),
    supabase.from('capital_accounts').select('*').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('capital_entries').select('*').eq('workspace_id', workspaceId).order('occurred_on', { ascending: false }),
  ])

  const failed = results.find((result) => result.error)
  if (failed?.error) return { data: null, error: failed.error.message }

  const [products, customers, suppliers, transactions, saleItems, supplierPayments, expenses, expenseCategories, capitalAccounts, capitalEntries] = results
  const saleItemsByTransaction = new Map<string, SaleLineItem[]>()
  for (const row of rows(saleItems.data)) {
    const transactionId = text(row.transaction_id)
    const item = mapSaleItem(row)
    saleItemsByTransaction.set(transactionId, [...(saleItemsByTransaction.get(transactionId) ?? []), item])
  }

  return {
    data: {
      products: rows(products.data).map(mapProduct),
      customers: rows(customers.data).map(mapCustomer),
      suppliers: rows(suppliers.data).map(mapSupplier),
      transactions: rows(transactions.data).map((row) => mapTransaction(row, saleItemsByTransaction)),
      supplierPayments: rows(supplierPayments.data).map((row) => {
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
      }),
      expenses: rows(expenses.data).map((row) => {
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
      }),
      expenseCategories: Array.from(new Set([
        ...defaultExpenseCategories,
        ...rows(expenseCategories.data).map((row) => text(row.name)).filter(Boolean),
      ])),
      capitalAccounts: rows(capitalAccounts.data).map((row) => ({
        id: text(row.id),
        name: text(row.name),
        ownerName: optionalText(row.owner_name),
        createdAt: text(row.created_at, new Date().toISOString()),
      })),
      capitalEntries: rows(capitalEntries.data).map((row) => {
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
      }),
    },
  }
}
