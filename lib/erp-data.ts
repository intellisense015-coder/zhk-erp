export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  inStockQuantity: number;
  reorderLevel: number;
  vendorName: string;
  sold: number;
  received: number;
};

export type SaleLineItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitSellingPrice: number;
  unitCost: number;
  discount: number;
  amount: number;
  profit: number;
};

export type Customer = {
  id: string;
  name: string;
  contactNumber: string;
  code: string;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactNumber: string;
  company: string;
  createdAt: string;
};

export type SupplierPayment = {
  id: string;
  supplierId: string;
  amount: number;
  note?: string;
  date: string;
  time: string;
};

export type Transaction = {
  id: string;
  type: "sale" | "purchase" | "transfer";
  name: string;
  party: string;
  quantity: number;
  amount: number;
  profit?: number;
  time: string;
  date: string;
  month: string;
  items?: SaleLineItem[];
  customerId?: string;
  supplierId?: string;
  customerContactNumber?: string;
  customerCode?: string;
  customerAccountNumber?: string;
  supplierContactNumber?: string;
  supplierCompany?: string;
  fromEntity?: string;
  toEntity?: string;
  transferKind?: "supplier-to-customer" | "customer-to-customer";
  paidAmount?: number;
  outstandingAmount?: number;
  productId?: string;
  unitCost?: number;
  createdAt?: string;
};

export const categories = ["All categories", "Mobiles", "Smartwatches", "Audio", "Chargers", "Cables", "Tablets", "Accessories"];
export const formatCurrency = (value: number) => `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
export const formatCompactCurrency = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000) return `Rs ${sign}${(absolute / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`;
  if (absolute >= 1_000) return `Rs ${sign}${(absolute / 1_000).toFixed(absolute >= 100_000 ? 0 : 1)}K`;
  return formatCurrency(value);
};

export function getMonthOptions(records: Transaction[]) {
  const months = Array.from(new Set(records.map((record) => record.month).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  return [{ value: "all", label: "All months" }, ...months.map((value) => ({ value, label: new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00`)) }))];
}

export function getTransactionItems(transaction: Transaction): SaleLineItem[] {
  return transaction.items ?? [];
}

export function formatTransactionTime(transaction: Transaction) {
  if (!transaction.createdAt) return transaction.time;
  const createdAt = new Date(transaction.createdAt);
  const elapsed = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const clock = new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", hour12: true }).format(createdAt);
  const current = new Date();
  const sameDay = current.getFullYear() === createdAt.getFullYear() && current.getMonth() === createdAt.getMonth() && current.getDate() === createdAt.getDate();
  if (sameDay) return clock;
  const date = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(createdAt);
  return `${date}, ${clock}`;
}
