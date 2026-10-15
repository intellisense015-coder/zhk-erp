"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Customer, Product, SaleLineItem, Supplier, SupplierPayment, Transaction } from "./erp-data";
import type { ProductFormValues, PurchaseFormValues, SaleFormValues } from "./validations";

// v2 intentionally starts with a clean workspace so the former demo snapshot
// cannot reappear as real business data. Records created in this version persist
// under this namespace across reloads.
const STORAGE_KEY = "solexa-erp-data-v2";
type StoreData = { products: Product[]; transactions: Transaction[]; customers: Customer[]; suppliers: Supplier[]; supplierPayments: SupplierPayment[] };
type StoreContextValue = StoreData & {
  hydrated: boolean;
  addProduct: (values: ProductFormValues) => { ok: true } | { ok: false; message: string };
  updateProduct: (id: string, values: ProductFormValues) => { ok: true } | { ok: false; message: string };
  deleteProduct: (id: string) => void;
  addCustomer: (values: { name: string; contactNumber: string }) => { ok: true; customer: Customer } | { ok: false; message: string };
  updateCustomer: (id: string, values: { name: string; contactNumber: string }) => { ok: true } | { ok: false; message: string };
  deleteCustomer: (id: string) => void;
  addSupplier: (values: { name: string; contactNumber: string; company?: string }) => { ok: true; supplier: Supplier } | { ok: false; message: string };
  updateSupplier: (id: string, values: { name: string; contactNumber: string; company?: string }) => { ok: true } | { ok: false; message: string };
  deleteSupplier: (id: string) => void;
  addPurchase: (values: PurchaseFormValues) => { ok: true } | { ok: false; message: string };
  updatePurchase: (id: string, values: { quantity: number; unitCost: number }) => { ok: true } | { ok: false; message: string };
  addSale: (values: SaleFormValues) => { ok: true } | { ok: false; message: string };
  addSupplierPayment: (values: { supplierId: string; amount: number; note?: string }) => { ok: true } | { ok: false; message: string };
  addTransfer: (values: { transferKind: "supplier-to-customer" | "customer-to-customer"; fromEntity: string; toEntity: string; productId: string; quantity: number; amount: number }) => { ok: true } | { ok: false; message: string };
  updateSale: (id: string, values: { customerName: string; items: SaleLineItem[] }) => { ok: true } | { ok: false; message: string };
};

const emptyStore: StoreData = { products: [], transactions: [], customers: [], suppliers: [], supplierPayments: [] };
const StoreContext = createContext<StoreContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
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

export function ErpStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(emptyStore);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<StoreData>;
          const products = Array.isArray(parsed.products) ? parsed.products.map((product) => ({ ...product, vendorName: product.vendorName ?? "Unassigned" })) : [];
          const customers = Array.isArray(parsed.customers) ? (parsed.customers as Array<Customer & { accountNumber?: string }>).map((customer, index, source) => ({ ...customer, code: makeUniqueCustomerCode(customer.code ?? customer.accountNumber ?? `CUST-${String(index + 1).padStart(3, "0")}`, source.slice(0, index).map((item) => ({ ...item, code: item.code ?? item.accountNumber ?? "" })) as Customer[]) })) : [];
          const parsedSuppliers = Array.isArray(parsed.suppliers) ? (parsed.suppliers as Array<Partial<Supplier>>).map((supplier) => ({ id: supplier.id ?? makeId("supplier"), name: supplier.name ?? "Unnamed supplier", contactNumber: supplier.contactNumber ?? "", company: supplier.company ?? "", createdAt: supplier.createdAt ?? new Date().toISOString() })) : [];
          const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions.map((transaction) => ({ ...transaction, customerCode: transaction.customerCode ?? transaction.customerAccountNumber, items: transaction.items?.map((item) => ({ ...item, discount: item.discount ?? 0 })) })) : [];
          const suppliers = [...parsedSuppliers];
          const transactions = rawTransactions.map((transaction) => {
            if (transaction.type !== "purchase") return transaction;
            const existing = suppliers.find((supplier) => supplier.id === transaction.supplierId || supplier.name.toLowerCase() === transaction.party.toLowerCase());
            if (existing) return { ...transaction, supplierId: existing.id };
            const supplier = { id: transaction.supplierId ?? makeId("supplier"), name: transaction.party, contactNumber: transaction.supplierContactNumber ?? "", company: transaction.supplierCompany ?? "", createdAt: new Date().toISOString() };
            suppliers.push(supplier);
            return { ...transaction, supplierId: supplier.id };
          });
          setData({ products, transactions, customers, suppliers, supplierPayments: Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : [] });
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

  const value = useMemo<StoreContextValue>(() => ({
    ...data,
    hydrated,
    addProduct: (values) => {
      const name = values.name.trim();
      const sku = normalizeSku(values.sku);
      if (data.products.some((product) => normalizeName(product.name) === normalizeName(name))) return { ok: false, message: "A product with this name already exists." };
      if (data.products.some((product) => normalizeSku(product.sku) === sku)) return { ok: false, message: "A product with this SKU already exists." };
      const existingSupplier = data.suppliers.find((supplier) => normalizeName(supplier.name) === normalizeName(values.vendorName));
      const supplier = existingSupplier ?? { id: makeId("supplier"), name: values.vendorName.trim(), contactNumber: "", company: "", createdAt: new Date().toISOString() };
      commit({ ...data, products: [...data.products, { ...values, name, sku, vendorName: supplier.name, id: makeId("product"), sold: 0, received: values.inStockQuantity }], suppliers: existingSupplier ? data.suppliers : [supplier, ...data.suppliers] });
      return { ok: true };
    },
    updateProduct: (id, values) => {
      const duplicate = data.products.find((product) => product.id !== id && (normalizeName(product.name) === normalizeName(values.name) || normalizeSku(product.sku) === normalizeSku(values.sku)));
      if (duplicate) return { ok: false, message: "Another product already uses this name or SKU." };
      const existingSupplier = data.suppliers.find((supplier) => normalizeName(supplier.name) === normalizeName(values.vendorName));
      const supplier = existingSupplier ?? { id: makeId("supplier"), name: values.vendorName.trim(), contactNumber: "", company: "", createdAt: new Date().toISOString() };
      commit({ ...data, products: data.products.map((product) => product.id === id ? { ...product, ...values, name: values.name.trim(), sku: normalizeSku(values.sku), vendorName: supplier.name } : product), suppliers: existingSupplier ? data.suppliers : [supplier, ...data.suppliers] });
      return { ok: true };
    },
    deleteProduct: (id) => {
      commit({ ...data, products: data.products.filter((product) => product.id !== id) });
    },
    addCustomer: (values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      if (!name || !contactNumber) return { ok: false, message: "Customer name and contact number are required." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      const customer: Customer = { id: makeId("customer"), name, contactNumber, code: makeUniqueCustomerCode(`CUST-${String(data.customers.length + 1).padStart(3, "0")}`, data.customers), createdAt: new Date().toISOString() };
      commit({ ...data, customers: [customer, ...data.customers] });
      return { ok: true, customer };
    },
    updateCustomer: (id, values) => {
      if (!values.name.trim() || !normalizeContact(values.contactNumber)) return { ok: false, message: "Customer name and contact number are required." };
      const contactNumber = normalizeContact(values.contactNumber);
      if (data.customers.some((customer) => customer.id !== id && customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number is already assigned to another customer." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a supplier and cannot be reused for a customer." };
      commit({ ...data, customers: data.customers.map((customer) => customer.id === id ? { ...customer, name: values.name.trim(), contactNumber } : customer) });
      return { ok: true };
    },
    deleteCustomer: (id) => {
      commit({ ...data, customers: data.customers.filter((customer) => customer.id !== id) });
    },
    addSupplier: (values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      const company = values.company?.trim() ?? "";
      if (!name || !contactNumber) return { ok: false, message: "Supplier name and contact number are required." };
      if (data.suppliers.some((supplier) => supplier.contactNumber === contactNumber)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const supplier: Supplier = { id: makeId("supplier"), name, contactNumber, company, createdAt: new Date().toISOString() };
      commit({ ...data, suppliers: [supplier, ...data.suppliers] });
      return { ok: true, supplier };
    },
    updateSupplier: (id, values) => {
      const name = values.name.trim();
      const contactNumber = normalizeContact(values.contactNumber);
      const company = values.company?.trim() ?? "";
      if (!name || !contactNumber) return { ok: false, message: "Supplier name and contact number are required." };
      if (data.suppliers.some((supplier) => supplier.id !== id && supplier.contactNumber === contactNumber)) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === contactNumber)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      commit({ ...data, suppliers: data.suppliers.map((supplier) => supplier.id === id ? { ...supplier, name, contactNumber, company } : supplier) });
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
      const supplierConflict = data.suppliers.find((supplier) => supplier.id !== values.supplierId && supplierContact && supplier.contactNumber === supplierContact);
      if (supplierConflict) return { ok: false, message: "This supplier contact number is already assigned to another supplier." };
      if (data.customers.some((customer) => customer.contactNumber === supplierContact)) return { ok: false, message: "This contact number belongs to a customer and cannot be reused for a supplier." };
      const existingSupplier = data.suppliers.find((supplier) => supplier.id === values.supplierId);
      const supplier = existingSupplier ? { ...existingSupplier, name: supplierName, contactNumber: supplierContact, company: supplierCompany } : { id: makeId("supplier"), name: supplierName, contactNumber: supplierContact, company: supplierCompany, createdAt: new Date().toISOString() };
      const total = values.quantity * values.unitCost;
      if (values.paidAmount > total) return { ok: false, message: "Paid amount cannot exceed the purchase total." };
      const { date, month } = getDateParts();
      const transaction: Transaction = { id: makeId("purchase"), type: "purchase", name: product.name, productId: product.id, unitCost: values.unitCost, party: supplier.name, supplierId: supplier.id, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company, quantity: values.quantity, amount: total, paidAmount: values.paidAmount, outstandingAmount: total - values.paidAmount, time: "Just now", createdAt: new Date().toISOString(), date, month };
      const nextSuppliers = existingSupplier ? data.suppliers.map((item) => item.id === supplier.id ? supplier : item) : [supplier, ...data.suppliers];
      const payment = values.paidAmount > 0 ? { id: makeId("payment"), supplierId: supplier.id, amount: values.paidAmount, note: "Paid with purchase", date, time: "Just now" } : null;
      commit({ products: data.products.map((item) => item.id === product.id ? { ...item, inStockQuantity: item.inStockQuantity + values.quantity, received: item.received + values.quantity, costPrice: values.unitCost } : item), transactions: [transaction, ...data.transactions], customers: data.customers, suppliers: nextSuppliers, supplierPayments: payment ? [payment, ...data.supplierPayments] : data.supplierPayments });
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
    addSale: (values) => {
      const contactNumber = normalizeContact(values.customerContactNumber);
      const customerCode = normalizeCode(values.customerCode);
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
        return { productId: product.id, name: product.name, sku: product.sku, quantity: line.quantity, unitSellingPrice: line.unitSellingPrice, unitCost: product.costPrice, discount: line.discount, amount, profit: amount - line.quantity * product.costPrice };
      });
      const error = lineItems.find((line) => "error" in line);
      if (error && "error" in error) return { ok: false, message: error.error };
      const items = lineItems.filter((line): line is SaleLineItem => !("error" in line));
      const { date, month } = getDateParts();
      const transaction: Transaction = { id: makeId("sale"), type: "sale", name: items.length === 1 ? items[0].name : `${items[0].name} + ${items.length - 1} more`, party: customer.name, customerId: customer.id, customerContactNumber: customer.contactNumber, customerCode: customer.code, quantity: items.reduce((sum, line) => sum + line.quantity, 0), amount: items.reduce((sum, line) => sum + line.amount, 0), profit: items.reduce((sum, line) => sum + line.profit, 0), time: "Just now", createdAt: new Date().toISOString(), date, month, items };
      commit({ products: data.products.map((product) => { const sold = items.find((item) => item.productId === product.id); return sold ? { ...product, inStockQuantity: product.inStockQuantity - sold.quantity, sold: product.sold + sold.quantity } : product; }), transactions: [transaction, ...data.transactions], customers: data.customers.some((item) => item.id === customer.id) ? data.customers.map((item) => item.id === customer.id ? customer : item) : [customer, ...data.customers], suppliers: data.suppliers, supplierPayments: data.supplierPayments });
      return { ok: true };
    },
    addSupplierPayment: (values) => {
      const supplier = data.suppliers.find((item) => item.id === values.supplierId);
      if (!supplier || values.amount <= 0) return { ok: false, message: "Choose a supplier and enter a payment greater than zero." };
      const purchased = data.transactions.filter((transaction) => transaction.type === "purchase" && transaction.supplierId === supplier.id).reduce((sum, transaction) => sum + transaction.amount, 0);
      const paid = data.supplierPayments.filter((payment) => payment.supplierId === supplier.id).reduce((sum, payment) => sum + payment.amount, 0);
      if (values.amount > purchased - paid) return { ok: false, message: "Payment cannot exceed the supplier's outstanding balance." };
      const { date } = getDateParts();
      const payment: SupplierPayment = { id: makeId("payment"), supplierId: supplier.id, amount: values.amount, note: values.note?.trim(), date, time: "Just now" };
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
        nextItems.push({ productId: product.id, name: product.name, sku: product.sku, quantity: item.quantity, unitSellingPrice: item.unitSellingPrice, unitCost, discount: item.discount, amount, profit: amount - item.quantity * unitCost });
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
      commit({ products: nextProducts, transactions: data.transactions.map((transaction) => transaction.id === id ? updatedSale : transaction), customers: data.customers.map((customer) => customer.id === sale.customerId ? { ...customer, name: values.customerName.trim() } : customer), suppliers: data.suppliers, supplierPayments: data.supplierPayments });
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
