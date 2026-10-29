"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultExpenseCategories, getCapitalSummary, productBrands, type CapitalAccount, type CapitalEntry, type Customer, type Expense, type Product, type SaleLineItem, type Supplier, type SupplierPayment, type Transaction } from "./erp-data";
import type { ExchangeFormValues, ProductFormValues, PurchaseFormValues, SaleFormValues } from "./validations";

// v2 intentionally starts with a clean workspace so the former demo snapshot
// cannot reappear as real business data. Records created in this version persist
// under this namespace across reloads.
const STORAGE_KEY = "solexa-erp-data-v2";
type StoreData = { products: Product[]; transactions: Transaction[]; customers: Customer[]; suppliers: Supplier[]; supplierPayments: SupplierPayment[]; expenses: Expense[]; expenseCategories: string[]; capitalAccounts: CapitalAccount[]; capitalEntries: CapitalEntry[] };
type StoreContextValue = StoreData & {
  hydrated: boolean;
  addProduct: (values: ProductFormValues) => { ok: true } | { ok: false; message: string };
  updateProduct: (id: string, values: ProductFormValues) => { ok: true } | { ok: false; message: string };
  deleteProduct: (id: string) => void;
  addCustomer: (values: { name: string; contactNumber: string; gender?: string; cnicNumber?: string }) => { ok: true; customer: Customer } | { ok: false; message: string };
  updateCustomer: (id: string, values: { name: string; contactNumber: string; gender?: string; cnicNumber?: string }) => { ok: true } | { ok: false; message: string };
  deleteCustomer: (id: string) => void;
  addSupplier: (values: { name: string; contactNumber: string; company?: string; cnicNumber?: string; openingBalance?: number }) => { ok: true; supplier: Supplier } | { ok: false; message: string };
  updateSupplier: (id: string, values: { name: string; contactNumber: string; company?: string; cnicNumber?: string; openingBalance?: number }) => { ok: true } | { ok: false; message: string };
  deleteSupplier: (id: string) => void;
  addPurchase: (values: PurchaseFormValues) => { ok: true } | { ok: false; message: string };
  updatePurchase: (id: string, values: { quantity: number; unitCost: number }) => { ok: true } | { ok: false; message: string };
  addSale: (values: SaleFormValues) => { ok: true } | { ok: false; message: string };
  addExchange: (values: ExchangeFormValues) => { ok: true } | { ok: false; message: string };
  addSupplierPayment: (values: { supplierId: string; amount: number; note?: string; capitalId?: string }) => { ok: true } | { ok: false; message: string };
  addExpense: (values: Omit<Expense, "id" | "date" | "month" | "createdAt">) => { ok: true } | { ok: false; message: string };
  addExpenseCategory: (name: string) => { ok: true } | { ok: false; message: string };
  updateExpense: (id: string, values: Omit<Expense, "id" | "date" | "month" | "createdAt">) => { ok: true } | { ok: false; message: string };
  deleteExpense: (id: string) => void;
  addCapitalAccount: (values: { name: string; ownerName?: string; amount: number; note?: string }) => { ok: true } | { ok: false; message: string };
  addCapitalEntry: (values: { capitalId: string; type: "contribution" | "withdrawal"; amount: number; note?: string }) => { ok: true } | { ok: false; message: string };
  addTransfer: (values: { transferKind: "supplier-to-customer" | "customer-to-customer"; fromEntity: string; toEntity: string; productId: string; quantity: number; amount: number }) => { ok: true } | { ok: false; message: string };
  updateSale: (id: string, values: { customerName: string; items: SaleLineItem[] }) => { ok: true } | { ok: false; message: string };
};

const emptyStore: StoreData = { products: [], transactions: [], customers: [], suppliers: [], supplierPayments: [], expenses: [], expenseCategories: defaultExpenseCategories, capitalAccounts: [], capitalEntries: [] };
const StoreContext = createContext<StoreContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function normalizeProductName(product: Partial<Product>) {
  const brand = productBrands.find((item) => item.value === product.brand);
  const model = product.model?.trim();
  if (!brand || brand.value === "other" || !model) return product.name ?? "Unnamed product";
  const cleanModel = model.replace(new RegExp(`^${brand.label}\\s+`, "i"), "");
  return `${brand.label} ${cleanModel}`.trim();
}

function getDateParts() {
  const date = new Date();
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { date: isoDate, month: isoDate.slice(0, 7) };
}

function makeUniqueCustomerCode(requested: string, customers: Customer[], currentId?: string) {
  const base = requested.trim().toUpperCase().replace(/\s+/g, "") || "CUST";
  let candidate = base;
  let suffix = 1;
  while (customers.some((customer) => customer.id !== currentId && customer.code === candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function makeInvoiceNumber(transactions: Transaction[]) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const highest = transactions.reduce((max, transaction) => {
    if (!transaction.invoiceNumber?.startsWith(prefix)) return max;
    const number = Number(transaction.invoiceNumber.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export function ErpStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(emptyStore);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<StoreData>;
          const products = Array.isArray(parsed.products) ? parsed.products.map((product) => { const normalized = { ...product, brand: product.brand ?? "other", model: product.model ?? product.name, color: product.color?.trim() || "Unspecified", vendorName: product.vendorName ?? "Unassigned" }; return { ...normalized, name: normalizeProductName(normalized) }; }) : [];
          const customers = Array.isArray(parsed.customers) ? (parsed.customers as Array<Customer & { accountNumber?: string }>).map((customer, index, source) => ({ ...customer, code: makeUniqueCustomerCode(customer.code ?? customer.accountNumber ?? `CUST-${String(index + 1).padStart(3, "0")}`, source.slice(0, index).map((item) => ({ ...item, code: item.code ?? item.accountNumber ?? "" })) as Customer[]) })) : [];
          const parsedSuppliers = Array.isArray(parsed.suppliers) ? (parsed.suppliers as Array<Partial<Supplier>>).map((supplier) => ({ id: supplier.id ?? makeId("supplier"), name: supplier.name ?? "Unnamed supplier", contactNumber: supplier.contactNumber ?? "", company: supplier.company ?? "", cnicNumber: supplier.cnicNumber ?? "", openingBalance: typeof supplier.openingBalance === "number" && Number.isFinite(supplier.openingBalance) ? Math.max(supplier.openingBalance, 0) : 0, createdAt: supplier.createdAt ?? new Date().toISOString() })) : [];
          const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions.map((transaction) => ({ ...transaction, customerCode: transaction.customerCode ?? transaction.customerAccountNumber, items: transaction.items?.map((item) => ({ ...item, discount: item.discount ?? 0 })) })) : [];
          const suppliers = [...parsedSuppliers];
          const transactions = rawTransactions.map((transaction) => {
            if (transaction.type !== "purchase") return transaction;
            const existing = suppliers.find((supplier) => supplier.id === transaction.supplierId || supplier.name.toLowerCase() === transaction.party.toLowerCase());
            if (existing) return { ...transaction, supplierId: existing.id };
            const supplier = { id: transaction.supplierId ?? makeId("supplier"), name: transaction.party, contactNumber: transaction.supplierContactNumber ?? "", company: transaction.supplierCompany ?? "", cnicNumber: "", openingBalance: 0, createdAt: new Date().toISOString() };
            suppliers.push(supplier);
            return { ...transaction, supplierId: supplier.id };
          });
          // Older inventory entries stored stock and its supplier on the product,
          // but did not create a purchase transaction. Import that stock once so
          // supplier purchase totals remain accurate after the data model change.
          const migratedPurchases: Transaction[] = products.flatMap((product) => {
            const vendorName = product.vendorName?.trim();
            const supplier = suppliers.find((item) => item.name.trim().toLowerCase() === vendorName?.toLowerCase());
            const received = Number(product.received ?? product.inStockQuantity ?? 0);
            const unitCost = Number(product.costPrice ?? 0);
            if (!supplier || !vendorName || vendorName.toLowerCase() === "unassigned" || received <= 0 || unitCost <= 0) return [];
            const recordedQuantity = transactions
              .filter((transaction) => transaction.type === "purchase" && transaction.productId === product.id && transaction.supplierId === supplier.id)
              .reduce((sum, transaction) => sum + transaction.quantity, 0);
            const quantity = Math.max(received - recordedQuantity, 0);
            if (!quantity) return [];
            const total = quantity * unitCost;
            const createdAt = new Date().toISOString();
            const { date, month } = getDateParts();
            return [{ id: makeId("purchase"), type: "purchase", source: "supplier", name: product.name, productId: product.id, unitCost, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity, amount: total, paidAmount: 0, outstandingAmount: total, time: "Imported from inventory", createdAt, date, month }];
          });
          const nextTransactions = [...migratedPurchases, ...transactions];
          const expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
          const expenseCategories = Array.isArray(parsed.expenseCategories) && parsed.expenseCategories.length ? Array.from(new Set(parsed.expenseCategories.filter((category): category is string => typeof category === "string" && Boolean(category.trim())).map((category) => category.trim()))) : defaultExpenseCategories;
          const capitalAccounts = Array.isArray(parsed.capitalAccounts) ? parsed.capitalAccounts : [];
          const capitalEntries = Array.isArray(parsed.capitalEntries) ? parsed.capitalEntries : [];
          const nextData = { products, transactions: nextTransactions, customers, suppliers, supplierPayments: Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : [], expenses, expenseCategories, capitalAccounts, capitalEntries };
          setData(nextData);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = (next: StoreData) => {
    setData(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const normalizeContact = (value: string) => value.replace(/\D/g, "");
  const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizeSku = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
  const ownerContact = typeof window !== "undefined" ? (() => {
    try {
      const profile = JSON.parse(window.localStorage.getItem("solexa-business-profile") || "null") as { contactNumber?: string } | null;
      return normalizeContact(profile?.contactNumber ?? "");
    } catch {
      return "";
    }
  })() : "";

  const value = useMemo<StoreContextValue>(() => ({
    ...data,
    hydrated,
    addProduct: (values) => {
      const brand = values.brand.trim();
      const model = values.model.trim();
      const color = values.color.trim();
      const name = values.name.trim() || `${brand} ${model}`.trim();
      const sku = normalizeSku(values.sku || `${brand}-${model}-${color}-SKU`);
      if (data.products.some((product) => normalizeName(product.name) === normalizeName(name) && normalizeName(product.color ?? "Unspecified") === normalizeName(color))) return { ok: false, message: "A product with this model and color already exists." };
      if (data.products.some((product) => normalizeSku(product.sku) === sku)) return { ok: false, message: "A product with this SKU already exists." };
      const vendorName = values.vendorName.trim();
      const vendorContact = normalizeContact(values.vendorContactNumber);
      const vendorCompany = values.vendorCompany?.trim() ?? "";
      const existingSupplier = data.suppliers.find((supplier) => normalizeName(supplier.name) === normalizeName(vendorName));
      if (!existingSupplier && !vendorContact) return { ok: false, message: "A contact number is required for a new supplier." };
      if (!existingSupplier && ownerContact && ownerContact === vendorContact) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
      if (!existingSupplier && data.suppliers.some((supplier) => supplier.contactNumber === vendorContact)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (!existingSupplier && data.customers.some((customer) => customer.contactNumber === vendorContact)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const supplier = existingSupplier ?? { id: makeId("supplier"), name: vendorName, contactNumber: vendorContact, company: vendorCompany, createdAt: new Date().toISOString() };
      const productId = makeId("product");
      const product = { ...values, name, sku, brand, model, color, vendorName: supplier.name, vendorContactNumber: supplier.contactNumber, vendorCompany: supplier.company, id: productId, sold: 0, received: values.inStockQuantity };
      const createdAt = new Date().toISOString();
      const { date, month } = getDateParts();
      const total = values.inStockQuantity * values.costPrice;
      const purchaseTransaction: Transaction | null = values.inStockQuantity > 0 ? { id: makeId("purchase"), type: "purchase", source: "supplier", name: product.name, productId, unitCost: values.costPrice, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity: values.inStockQuantity, amount: total, paidAmount: 0, outstandingAmount: total, time: "Just now", createdAt, date, month } : null;
      commit({ ...data, products: [...data.products, product], transactions: purchaseTransaction ? [purchaseTransaction, ...data.transactions] : data.transactions, suppliers: existingSupplier ? data.suppliers : [supplier, ...data.suppliers] });
      return { ok: true };
    },
    updateProduct: (id, values) => {
      const brand = values.brand.trim();
      const model = values.model.trim();
      const color = values.color.trim();
      const name = values.name.trim() || `${brand} ${model}`.trim();
      const sku = normalizeSku(values.sku || `${brand}-${model}-${color}-SKU`);
      const duplicate = data.products.find((product) => product.id !== id && ((normalizeName(product.name) === normalizeName(name) && normalizeName(product.color ?? "Unspecified") === normalizeName(color)) || normalizeSku(product.sku) === sku));
      if (duplicate) return { ok: false, message: "Another product already uses this model/color or SKU." };
      const vendorName = values.vendorName.trim();
      const vendorContact = normalizeContact(values.vendorContactNumber);
      const vendorCompany = values.vendorCompany?.trim() ?? "";
      const existingSupplier = data.suppliers.find((supplier) => normalizeName(supplier.name) === normalizeName(vendorName));
      if (!existingSupplier && !vendorContact) return { ok: false, message: "A contact number is required for a new supplier." };
      if (!existingSupplier && ownerContact && ownerContact === vendorContact) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
      if (!existingSupplier && data.suppliers.some((supplier) => supplier.contactNumber === vendorContact)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (!existingSupplier && data.customers.some((customer) => customer.contactNumber === vendorContact)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const supplier = existingSupplier ?? { id: makeId("supplier"), name: vendorName, contactNumber: vendorContact, company: vendorCompany, createdAt: new Date().toISOString() };
      const existingProduct = data.products.find((product) => product.id === id);
      const stockIncrease = Math.max(values.inStockQuantity - (existingProduct?.inStockQuantity ?? 0), 0);
      const createdAt = new Date().toISOString();
      const { date, month } = getDateParts();
      const total = stockIncrease * values.costPrice;
      const purchaseTransaction: Transaction | null = stockIncrease > 0 ? { id: makeId("purchase"), type: "purchase", source: "supplier", name, productId: id, unitCost: values.costPrice, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity: stockIncrease, amount: total, paidAmount: 0, outstandingAmount: total, time: "Just now", createdAt, date, month } : null;
      commit({ ...data, products: data.products.map((product) => product.id === id ? { ...product, ...values, name, sku, brand, model, color, vendorName: supplier.name, vendorContactNumber: supplier.contactNumber, vendorCompany: supplier.company } : product), transactions: purchaseTransaction ? [purchaseTransaction, ...data.transactions] : data.transactions, suppliers: existingSupplier ? data.suppliers : [supplier, ...data.suppliers] });
      return { ok: true };
    },
    deleteProduct: (id) => {
      commit({ ...data, products: data.products.filter((product) => product.id !== id) });
    },
    addCustomer: (values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      if (!name || !contactNumber) return { ok: false, message: "Customer name and contact number are required." };
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a customer contact." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      const customer: Customer = { id: makeId("customer"), name, contactNumber, gender: values.gender?.trim() ?? "", cnicNumber: values.cnicNumber?.trim() ?? "", code: makeUniqueCustomerCode(`CUST-${String(data.customers.length + 1).padStart(3, "0")}`, data.customers), createdAt: new Date().toISOString() };
      commit({ ...data, customers: [customer, ...data.customers] });
      return { ok: true, customer };
    },
    updateCustomer: (id, values) => {
      if (!values.name.trim() || !normalizeContact(values.contactNumber)) return { ok: false, message: "Customer name and contact number are required." };
      const contactNumber = normalizeContact(values.contactNumber);
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a customer contact." };
      if (data.customers.some((customer) => customer.id !== id && customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      commit({ ...data, customers: data.customers.map((customer) => customer.id === id ? { ...customer, name: values.name.trim(), contactNumber, gender: values.gender?.trim() ?? "", cnicNumber: values.cnicNumber?.trim() ?? "" } : customer) });
      return { ok: true };
    },
    deleteCustomer: (id) => {
      commit({ ...data, customers: data.customers.filter((customer) => customer.id !== id) });
    },
    addSupplier: (values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      const company = values.company?.trim() ?? "";
      const cnicNumber = values.cnicNumber?.trim() ?? "";
      const openingBalance = typeof values.openingBalance === "number" && Number.isFinite(values.openingBalance) ? Math.max(values.openingBalance, 0) : 0;
      if (!name || !contactNumber) return { ok: false, message: "Supplier name and contact number are required." };
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const supplier: Supplier = { id: makeId("supplier"), name, contactNumber, company, cnicNumber, openingBalance, createdAt: new Date().toISOString() };
      commit({ ...data, suppliers: [supplier, ...data.suppliers] });
      return { ok: true, supplier };
    },
    updateSupplier: (id, values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      const company = values.company?.trim() ?? "";
      const cnicNumber = values.cnicNumber?.trim() ?? "";
      const openingBalance = typeof values.openingBalance === "number" && Number.isFinite(values.openingBalance) ? Math.max(values.openingBalance, 0) : 0;
      if (!name || !contactNumber) return { ok: false, message: "Supplier name and contact number are required." };
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
      if (data.suppliers.some((supplier) => supplier.id !== id && supplier.contactNumber === contactNumber)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      commit({ ...data, suppliers: data.suppliers.map((supplier) => supplier.id === id ? { ...supplier, name, contactNumber, company, cnicNumber, openingBalance } : supplier) });
      return { ok: true };
    },
    deleteSupplier: (id) => {
      commit({ ...data, suppliers: data.suppliers.filter((supplier) => supplier.id !== id) });
    },
    addPurchase: (values) => {
      const product = data.products.find((item) => item.id === values.productId);
      if (!product) return { ok: false, message: "Add a product before recording stock." };
      const supplierName = values.vendorName.trim();
      const supplierContact = normalizeContact(values.supplierContactNumber);
      const supplierCompany = values.supplierCompany?.trim() ?? "";
      if (ownerContact && ownerContact === supplierContact) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
      const supplierConflict = data.suppliers.find((supplier) => supplier.id !== values.supplierId && supplierContact && supplier.contactNumber === supplierContact);
      if (supplierConflict) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === supplierContact)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const existingSupplier = data.suppliers.find((supplier) => supplier.id === values.supplierId);
      const supplier = existingSupplier ? { ...existingSupplier, name: supplierName, contactNumber: supplierContact, company: supplierCompany } : { id: makeId("supplier"), name: supplierName, contactNumber: supplierContact, company: supplierCompany, createdAt: new Date().toISOString() };
      const total = values.quantity * values.unitCost;
      if (values.paidAmount > total) return { ok: false, message: "Paid amount cannot exceed the purchase total." };
      const capitalId = values.fundingSource === "capital" ? values.capitalId : undefined;
      if (values.fundingSource === "capital" && !capitalId) return { ok: false, message: "Choose a capital account for this purchase." };
      if (capitalId && values.paidAmount > getCapitalSummary(capitalId, data.capitalEntries, data.transactions, data.supplierPayments, data.expenses).available) return { ok: false, message: "The purchase payment exceeds the available capital." };
      const { date, month } = getDateParts();
      const transaction: Transaction = { id: makeId("purchase"), type: "purchase", name: product.name, productId: product.id, unitCost: values.unitCost, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity: values.quantity, amount: total, paidAmount: values.paidAmount, outstandingAmount: total - values.paidAmount, fundingSource: values.fundingSource ?? "other", capitalId, time: "Just now", createdAt: new Date().toISOString(), date, month };
      const nextSuppliers = existingSupplier ? data.suppliers.map((item) => item.id === supplier.id ? supplier : item) : [supplier, ...data.suppliers];
      const payment = values.paidAmount > 0 ? { id: makeId("payment"), supplierId: supplier.id, amount: values.paidAmount, note: "Paid with purchase", capitalId, date, time: "Just now", createdAt: new Date().toISOString() } : null;
      commit({ products: data.products.map((item) => item.id === product.id ? { ...item, inStockQuantity: item.inStockQuantity + values.quantity, received: item.received + values.quantity, costPrice: values.unitCost } : item), transactions: [transaction, ...data.transactions], customers: data.customers, suppliers: nextSuppliers, supplierPayments: payment ? [payment, ...data.supplierPayments] : data.supplierPayments, expenses: data.expenses, expenseCategories: data.expenseCategories, capitalAccounts: data.capitalAccounts, capitalEntries: data.capitalEntries });
      return { ok: true };
    },
    updatePurchase: (id, values) => {
      if (!Number.isInteger(values.quantity) || values.quantity <= 0 || values.unitCost <= 0) return { ok: false, message: "Quantity and unit cost must be greater than zero." };
      const purchase = data.transactions.find((transaction) => transaction.id === id && transaction.type === "purchase");
      if (!purchase) return { ok: false, message: "Purchase record not found." };
      const product = data.products.find((item) => item.id === purchase.productId || item.name === purchase.name);
      if (!product) return { ok: false, message: "The product attached to this purchase no longer exists." };
      const previousPaid = purchase.paidAmount ?? 0;
      const total = values.quantity * values.unitCost;
      if (previousPaid > total) return { ok: false, message: "Purchase total cannot be lower than the amount already paid." };
      const quantityDelta = values.quantity - purchase.quantity;
      if (product.inStockQuantity + quantityDelta < 0) return { ok: false, message: "The edited purchase would make stock negative." };
      const updated: Transaction = { ...purchase, quantity: values.quantity, unitCost: values.unitCost, amount: total, outstandingAmount: total - previousPaid };
      commit({ ...data, products: data.products.map((item) => item.id === product.id ? { ...item, inStockQuantity: item.inStockQuantity + quantityDelta, received: item.received + quantityDelta, costPrice: values.unitCost } : item), transactions: data.transactions.map((transaction) => transaction.id === id ? updated : transaction) });
      return { ok: true };
    },
    addExpense: (values) => {
      const description = values.description.trim();
      if (!description || !values.category.trim() || !Number.isFinite(values.amount) || values.amount <= 0) return { ok: false, message: "Category, description, and an amount greater than zero are required." };
      if (values.capitalId && values.amount > getCapitalSummary(values.capitalId, data.capitalEntries, data.transactions, data.supplierPayments, data.expenses).available) return { ok: false, message: "The expense exceeds the available capital." };
      const { date, month } = getDateParts();
      const expense: Expense = { ...values, id: makeId("expense"), category: values.category.trim(), description, amount: values.amount, date, month, createdAt: new Date().toISOString() };
      commit({ ...data, expenses: [expense, ...data.expenses] });
      return { ok: true };
    },
    addExpenseCategory: (name) => {
      const category = name.trim();
      if (!category) return { ok: false, message: "Enter a category name." };
      if (data.expenseCategories.some((item) => normalizeName(item) === normalizeName(category))) return { ok: false, message: "This expense category already exists." };
      commit({ ...data, expenseCategories: [...data.expenseCategories, category] });
      return { ok: true };
    },
    updateExpense: (id, values) => {
      const existing = data.expenses.find((expense) => expense.id === id);
      if (!existing) return { ok: false, message: "Expense record not found." };
      const description = values.description.trim();
      if (!description || !values.category.trim() || !Number.isFinite(values.amount) || values.amount <= 0) return { ok: false, message: "Category, description, and an amount greater than zero are required." };
      const currentCapitalUsage = existing.capitalId && existing.capitalId === values.capitalId ? existing.amount : 0;
      const available = values.capitalId ? getCapitalSummary(values.capitalId, data.capitalEntries, data.transactions, data.supplierPayments, data.expenses).available + currentCapitalUsage : Number.POSITIVE_INFINITY;
      if (values.capitalId && values.amount > available) return { ok: false, message: "The expense exceeds the available capital." };
      commit({ ...data, expenses: data.expenses.map((expense) => expense.id === id ? { ...expense, ...values, category: values.category.trim(), description, amount: values.amount, capitalId: values.capitalId } : expense) });
      return { ok: true };
    },
    deleteExpense: (id) => commit({ ...data, expenses: data.expenses.filter((expense) => expense.id !== id) }),
    addCapitalAccount: (values) => {
      const name = values.name.trim();
      if (!name || !Number.isFinite(values.amount) || values.amount <= 0) return { ok: false, message: "Enter a capital name and an opening amount greater than zero." };
      if (data.capitalAccounts.some((account) => normalizeName(account.name) === normalizeName(name))) return { ok: false, message: "A capital account with this name already exists." };
      const { date, month } = getDateParts();
      const account: CapitalAccount = { id: makeId("capital"), name, ownerName: values.ownerName?.trim() ?? "", createdAt: new Date().toISOString() };
      const entry: CapitalEntry = { id: makeId("capital-entry"), capitalId: account.id, type: "contribution", amount: values.amount, date, month, note: values.note?.trim(), createdAt: new Date().toISOString() };
      commit({ ...data, capitalAccounts: [account, ...data.capitalAccounts], capitalEntries: [entry, ...data.capitalEntries] });
      return { ok: true };
    },
    addCapitalEntry: (values) => {
      const account = data.capitalAccounts.find((item) => item.id === values.capitalId);
      if (!account || !Number.isFinite(values.amount) || values.amount <= 0) return { ok: false, message: "Choose a capital account and enter an amount greater than zero." };
      if (values.type === "withdrawal" && values.amount > getCapitalSummary(values.capitalId, data.capitalEntries, data.transactions, data.supplierPayments, data.expenses).available) return { ok: false, message: "The withdrawal exceeds the available capital." };
      const { date, month } = getDateParts();
      const entry: CapitalEntry = { id: makeId("capital-entry"), ...values, amount: values.amount, note: values.note?.trim(), date, month, createdAt: new Date().toISOString() };
      commit({ ...data, capitalEntries: [entry, ...data.capitalEntries] });
      return { ok: true };
    },
    addSale: (values) => {
      if (values.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitSellingPrice) || item.unitSellingPrice <= 0 || item.discount < 0)) return { ok: false, message: "Quantity, selling price, and discount values must be valid." };
      const contactNumber = normalizeContact(values.customerContactNumber);
      const customerCode = normalizeCode(values.customerCode);
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a customer contact." };
      const contactOwner = data.customers.find((customer) => customer.contactNumber === contactNumber);
      const codeOwner = data.customers.find((customer) => customer.code === customerCode);
      if (contactOwner && contactOwner.code !== customerCode) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (codeOwner && codeOwner.contactNumber !== contactNumber) return { ok: false, message: "This customer code is already assigned to another customer." };
      if (!contactOwner && data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      const selectedCustomer = values.customerId ? data.customers.find((customer) => customer.id === values.customerId) : undefined;
      const existingCustomer = selectedCustomer ?? contactOwner ?? codeOwner;
      const customer = existingCustomer ? { ...existingCustomer, name: values.customerName.trim(), contactNumber, code: makeUniqueCustomerCode(customerCode, data.customers, existingCustomer.id) } : { id: makeId("customer"), name: values.customerName.trim(), contactNumber, code: makeUniqueCustomerCode(customerCode, data.customers), createdAt: new Date().toISOString() };
      const lineItems: Array<SaleLineItem | { error: string }> = values.items.map((line) => {
        const product = data.products.find((item) => item.id === line.productId);
        if (!product) return { error: "One of the selected products no longer exists." } as const;
        if (line.quantity > product.inStockQuantity) return { error: `${product.name} only has ${product.inStockQuantity} units available.` } as const;
        const subtotal = line.quantity * line.unitSellingPrice;
        if (line.discount > subtotal) return { error: `${product.name} discount cannot exceed the line subtotal.` } as const;
        const amount = subtotal - line.discount;
        return { productId: product.id, name: product.name, sku: product.sku, color: product.color, quantity: line.quantity, unitSellingPrice: line.unitSellingPrice, unitCost: product.costPrice, discount: line.discount, amount, profit: amount - line.quantity * product.costPrice };
      });
      const error = lineItems.find((line) => "error" in line);
      if (error && "error" in error) return { ok: false, message: error.error };
      const items = lineItems.filter((line): line is SaleLineItem => !("error" in line));
      const { date, month } = getDateParts();
      const transaction: Transaction = { id: makeId("sale"), type: "sale", invoiceNumber: makeInvoiceNumber(data.transactions), name: items.length === 1 ? items[0].name : `${items[0].name} + ${items.length - 1} more`, party: customer.name, customerId: customer.id, customerContactNumber: customer.contactNumber, customerCode: customer.code, quantity: items.reduce((sum, line) => sum + line.quantity, 0), amount: items.reduce((sum, line) => sum + line.amount, 0), profit: items.reduce((sum, line) => sum + line.profit, 0), time: "Just now", createdAt: new Date().toISOString(), date, month, items };
      commit({ products: data.products.map((product) => { const sold = items.find((item) => item.productId === product.id); return sold ? { ...product, inStockQuantity: product.inStockQuantity - sold.quantity, sold: product.sold + sold.quantity } : product; }), transactions: [transaction, ...data.transactions], customers: data.customers.some((item) => item.id === customer.id) ? data.customers.map((item) => item.id === customer.id ? customer : item) : [customer, ...data.customers], suppliers: data.suppliers, supplierPayments: data.supplierPayments, expenses: data.expenses, expenseCategories: data.expenseCategories, capitalAccounts: data.capitalAccounts, capitalEntries: data.capitalEntries });
      return { ok: true };
    },
    addExchange: (values) => {
      const givenProduct = data.products.find((product) => product.id === values.givenProductId);
      const isBuyback = values.mode === "buyback";
      const receivedProduct = values.receivedProductId ? data.products.find((product) => product.id === values.receivedProductId) : undefined;
      const receivedQuantity = values.receivedQuantity ?? 0;
      const receivedUnitSellingPrice = values.receivedUnitSellingPrice ?? 0;
      const receiveSource = values.receiveSource ?? "inventory";
      if (!givenProduct) return { ok: false, message: "Choose the phone received from the customer." };
      if (!isBuyback && !receivedProduct) return { ok: false, message: "Choose the replacement phone sold to the customer." };
      if (!isBuyback && givenProduct.id === receivedProduct?.id) return { ok: false, message: "The trade-in and replacement phone must be different products." };
      if (!Number.isInteger(values.givenQuantity) || values.givenQuantity <= 0 || (!isBuyback && (!Number.isInteger(receivedQuantity) || receivedQuantity <= 0))) return { ok: false, message: "Quantities must be whole numbers greater than zero." };
      if (values.tradeInUnitValue <= 0 || (!isBuyback && receivedUnitSellingPrice <= 0)) return { ok: false, message: "Trade-in value and selling price must be greater than zero." };
      if (!isBuyback && receiveSource === "inventory" && receivedProduct && receivedQuantity > receivedProduct.inStockQuantity) return { ok: false, message: `${receivedProduct.name} only has ${receivedProduct.inStockQuantity} units available. Choose supplier arrangement or add stock first.` };
      const contactNumber = normalizeContact(values.customerContactNumber);
      const customerCode = normalizeCode(values.customerCode);
      if (ownerContact && ownerContact === contactNumber) return { ok: false, message: "The business owner's number cannot be used as a customer contact." };
      const contactOwner = data.customers.find((customer) => customer.contactNumber === contactNumber);
      const codeOwner = data.customers.find((customer) => customer.code === customerCode);
      if (contactOwner && contactOwner.code !== customerCode) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (codeOwner && codeOwner.contactNumber !== contactNumber) return { ok: false, message: "This customer code is already assigned to another customer." };
      if (!contactOwner && data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      const selectedCustomer = values.customerId ? data.customers.find((customer) => customer.id === values.customerId) : undefined;
      const existingCustomer = selectedCustomer ?? contactOwner ?? codeOwner;
      const customer = existingCustomer ? { ...existingCustomer, name: values.customerName.trim(), contactNumber, code: makeUniqueCustomerCode(customerCode, data.customers, existingCustomer.id) } : { id: makeId("customer"), name: values.customerName.trim(), contactNumber, code: makeUniqueCustomerCode(customerCode, data.customers), createdAt: new Date().toISOString() };
      if (!customer.name || !contactNumber) return { ok: false, message: "Customer name and contact number are required." };

      let supplier: Supplier | undefined;
      let purchaseTransaction: Transaction | undefined;
      let purchasePayment: SupplierPayment | null = null;
      const exchangeId = makeId("exchange");
      const { date, month } = getDateParts();
      if (!isBuyback && receiveSource === "supplier" && receivedProduct) {
        const supplierName = values.supplierName.trim();
        const supplierContact = normalizeContact(values.supplierContactNumber);
        const supplierCompany = values.supplierCompany?.trim() ?? "";
        if (!supplierName || !supplierContact) return { ok: false, message: "Supplier name and contact number are required when arranging the replacement phone." };
        if (ownerContact && ownerContact === supplierContact) return { ok: false, message: "The business owner's number cannot be used as a supplier contact." };
        if (data.customers.some((customerRecord) => customerRecord.contactNumber === supplierContact)) return { ok: false, message: "This supplier contact number belongs to a customer." };
        const supplierConflict = data.suppliers.find((supplierRecord) => supplierRecord.id !== values.supplierId && supplierContact && supplierRecord.contactNumber === supplierContact);
        if (supplierConflict) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
        const supplierTotal = receivedQuantity * values.supplierUnitCost;
        if (values.supplierUnitCost <= 0) return { ok: false, message: "Supplier cost must be greater than zero." };
        if (values.supplierPaidAmount < 0 || values.supplierPaidAmount > supplierTotal) return { ok: false, message: "Supplier payment cannot exceed the supplier purchase total." };
        const existingSupplier = data.suppliers.find((supplierRecord) => supplierRecord.id === values.supplierId || normalizeName(supplierRecord.name) === normalizeName(supplierName));
        supplier = existingSupplier ? { ...existingSupplier, name: supplierName, contactNumber: supplierContact, company: supplierCompany } : { id: makeId("supplier"), name: supplierName, contactNumber: supplierContact, company: supplierCompany, createdAt: new Date().toISOString() };
        purchaseTransaction = { id: makeId("purchase"), type: "purchase", source: "supplier", exchangeId, name: receivedProduct.name, productId: receivedProduct.id, unitCost: values.supplierUnitCost, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity: receivedQuantity, amount: supplierTotal, paidAmount: values.supplierPaidAmount, outstandingAmount: supplierTotal - values.supplierPaidAmount, time: "Just now", createdAt: new Date().toISOString(), date, month };
        purchasePayment = values.supplierPaidAmount > 0 ? { id: makeId("payment"), supplierId: supplier.id, amount: values.supplierPaidAmount, note: "Paid with exchange arrangement", date, time: "Just now", createdAt: new Date().toISOString() } : null;
      }

      const tradeInTotal = values.givenQuantity * values.tradeInUnitValue;
      const saleTotal = receivedQuantity * receivedUnitSellingPrice;
      const amountDue = saleTotal - tradeInTotal;
      const receivingUnitCost = receiveSource === "supplier" ? values.supplierUnitCost : receivedProduct?.costPrice ?? 0;
      const buybackTransaction: Transaction = { id: makeId("buyback"), type: "purchase", source: "customer-trade-in", exchangeId, name: givenProduct.name, productId: givenProduct.id, unitCost: values.tradeInUnitValue, party: customer.name, customerId: customer.id, customerContactNumber: customer.contactNumber, customerCode: customer.code, quantity: values.givenQuantity, amount: tradeInTotal, paidAmount: tradeInTotal, outstandingAmount: 0, time: "Just now", createdAt: new Date().toISOString(), date, month };
      const saleItems: SaleLineItem[] = !isBuyback && receivedProduct ? [{ productId: receivedProduct.id, name: receivedProduct.name, sku: receivedProduct.sku, color: receivedProduct.color, quantity: receivedQuantity, unitSellingPrice: receivedUnitSellingPrice, unitCost: receivingUnitCost, discount: 0, amount: saleTotal, profit: saleTotal - receivedQuantity * receivingUnitCost }] : [];
      const saleTransaction: Transaction | undefined = !isBuyback && receivedProduct ? { id: makeId("sale"), type: "sale", invoiceNumber: makeInvoiceNumber(data.transactions), source: "exchange", exchangeId, name: receivedProduct.name, party: customer.name, customerId: customer.id, customerContactNumber: customer.contactNumber, customerCode: customer.code, quantity: receivedQuantity, amount: saleTotal, profit: saleItems[0].profit, tradeInCredit: tradeInTotal, amountDue, time: "Just now", createdAt: new Date().toISOString(), date, month, items: saleItems } : undefined;
      const nextSuppliers = !isBuyback && receiveSource === "supplier" && supplier ? (data.suppliers.some((item) => item.id === supplier?.id) ? data.suppliers.map((item) => item.id === supplier?.id ? supplier as Supplier : item) : [supplier, ...data.suppliers]) : data.suppliers;
      const nextProducts = data.products.map((product) => {
        if (product.id === givenProduct.id) return { ...product, inStockQuantity: product.inStockQuantity + values.givenQuantity, received: product.received + values.givenQuantity, costPrice: values.tradeInUnitValue };
        if (!isBuyback && receivedProduct && product.id === receivedProduct.id) return { ...product, inStockQuantity: product.inStockQuantity + (receiveSource === "supplier" ? receivedQuantity : 0) - receivedQuantity, received: product.received + (receiveSource === "supplier" ? receivedQuantity : 0), sold: product.sold + receivedQuantity, costPrice: receiveSource === "supplier" ? values.supplierUnitCost : product.costPrice };
        return product;
      });
      const nextTransactions = [ ...(saleTransaction ? [saleTransaction] : []), buybackTransaction, ...(purchaseTransaction ? [purchaseTransaction] : []), ...data.transactions];
      commit({ products: nextProducts, transactions: nextTransactions, customers: data.customers.some((item) => item.id === customer.id) ? data.customers.map((item) => item.id === customer.id ? customer : item) : [customer, ...data.customers], suppliers: nextSuppliers, supplierPayments: purchasePayment ? [purchasePayment, ...data.supplierPayments] : data.supplierPayments, expenses: data.expenses, expenseCategories: data.expenseCategories, capitalAccounts: data.capitalAccounts, capitalEntries: data.capitalEntries });
      return { ok: true };
    },
    addSupplierPayment: (values) => {
      const supplier = data.suppliers.find((item) => item.id === values.supplierId);
      if (!supplier || values.amount <= 0) return { ok: false, message: "Choose a supplier and enter a payment greater than zero." };
      const purchased = data.transactions.filter((transaction) => transaction.type === "purchase" && transaction.supplierId === supplier.id).reduce((sum, transaction) => sum + transaction.amount, 0);
      const paid = data.supplierPayments.filter((payment) => payment.supplierId === supplier.id).reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = purchased + (supplier.openingBalance ?? 0) - paid;
      if (values.amount > outstanding) return { ok: false, message: "Payment cannot exceed the supplier's outstanding balance." };
      if (values.capitalId && values.amount > getCapitalSummary(values.capitalId, data.capitalEntries, data.transactions, data.supplierPayments, data.expenses).available) return { ok: false, message: "The supplier payment exceeds the available capital." };
      const { date } = getDateParts();
      const payment: SupplierPayment = { id: makeId("payment"), supplierId: supplier.id, amount: values.amount, capitalId: values.capitalId, note: values.note?.trim(), date, time: "Just now", createdAt: new Date().toISOString() };
      commit({ ...data, supplierPayments: [payment, ...data.supplierPayments] });
      return { ok: true };
    },
    addTransfer: (values) => {
      const product = data.products.find((item) => item.id === values.productId);
      if (!product) return { ok: false, message: "Choose a product for the transfer." };
      if (!Number.isInteger(values.quantity) || values.quantity <= 0) return { ok: false, message: "Transfer quantity must be greater than zero." };
      if (values.quantity > product.inStockQuantity) return { ok: false, message: `${product.name} only has ${product.inStockQuantity} units available.` };
      if (!values.fromEntity.trim() || !values.toEntity.trim() || values.fromEntity.trim().toLowerCase() === values.toEntity.trim().toLowerCase()) return { ok: false, message: "Choose two different entities." };
      const { date, month } = getDateParts();
      const transaction: Transaction = { id: makeId("transfer"), type: "transfer", name: product.name, productId: product.id, party: `${values.fromEntity.trim()} → ${values.toEntity.trim()}`, quantity: values.quantity, amount: values.amount, fromEntity: values.fromEntity.trim(), toEntity: values.toEntity.trim(), transferKind: values.transferKind, time: "Just now", createdAt: new Date().toISOString(), date, month };
      commit({ ...data, transactions: [transaction, ...data.transactions] });
      return { ok: true };
    },
    updateSale: (id, values) => {
      const sale = data.transactions.find((transaction) => transaction.id === id && transaction.type === "sale");
      if (!sale || !sale.items?.length) return { ok: false, message: "This sale cannot be edited because its line items are unavailable." };
      if (values.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitSellingPrice <= 0 || item.discount < 0)) return { ok: false, message: "Quantity and selling price must be greater than zero." };
      if (values.items.some((item) => item.discount > item.quantity * item.unitSellingPrice)) return { ok: false, message: "Discount cannot exceed a line subtotal." };
      const previousItems = sale.items ?? [];
      const nextItems: SaleLineItem[] = [];
      for (const item of values.items) {
        const product = data.products.find((entry) => entry.id === item.productId);
        if (!product) return { ok: false, message: "One of the selected products no longer exists." };
        const previous = previousItems.find((line) => line.productId === item.productId);
        const unitCost = previous?.unitCost ?? product.costPrice;
        const subtotal = item.quantity * item.unitSellingPrice;
        const amount = subtotal - item.discount;
        nextItems.push({ productId: product.id, name: product.name, sku: product.sku, color: product.color, quantity: item.quantity, unitSellingPrice: item.unitSellingPrice, unitCost, discount: item.discount, amount, profit: amount - item.quantity * unitCost });
      }
      const stockIssue = Array.from(new Set([...previousItems.map((item) => item.productId), ...nextItems.map((item) => item.productId)])).map((productId) => {
        const product = data.products.find((entry) => entry.id === productId);
        const previousQuantity = previousItems.find((item) => item.productId === productId)?.quantity ?? 0;
        const nextQuantity = nextItems.find((item) => item.productId === productId)?.quantity ?? 0;
        return product && product.inStockQuantity + previousQuantity - nextQuantity < 0 ? `${product.name} does not have enough stock for this edit.` : null;
      }).find(Boolean);
      if (stockIssue) return { ok: false, message: stockIssue };
      const nextProducts = data.products.map((product) => {
        const previousQuantity = previousItems.find((item) => item.productId === product.id)?.quantity ?? 0;
        const nextQuantity = nextItems.find((item) => item.productId === product.id)?.quantity ?? 0;
        if (!previousQuantity && !nextQuantity) return product;
        return { ...product, inStockQuantity: product.inStockQuantity + previousQuantity - nextQuantity, sold: product.sold + nextQuantity - previousQuantity };
      });
      const amount = nextItems.reduce((sum, item) => sum + item.amount, 0);
      const profit = nextItems.reduce((sum, item) => sum + item.profit, 0);
      const updatedSale: Transaction = { ...sale, party: values.customerName.trim(), name: nextItems.length === 1 ? nextItems[0].name : `${nextItems[0].name} + ${nextItems.length - 1} more`, quantity: nextItems.reduce((sum, item) => sum + item.quantity, 0), amount, profit, items: nextItems };
      commit({ products: nextProducts, transactions: data.transactions.map((transaction) => transaction.id === id ? updatedSale : transaction), customers: data.customers.map((customer) => customer.id === sale.customerId ? { ...customer, name: values.customerName.trim() } : customer), suppliers: data.suppliers, supplierPayments: data.supplierPayments, expenses: data.expenses, expenseCategories: data.expenseCategories, capitalAccounts: data.capitalAccounts, capitalEntries: data.capitalEntries });
      return { ok: true };
    },
  }), [data, hydrated]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useErpStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useErpStore must be used inside ErpStoreProvider");
  return context;
}
