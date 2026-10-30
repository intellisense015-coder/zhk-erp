import { formatCurrency, getTransactionItems, type Expense, type Transaction } from "./erp-data";

export type InvoiceKind = "sale" | "purchase" | "expense";
export type InvoiceRecord = Transaction | Expense;

export type InvoiceLine = {
  name: string;
  detail?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
};

export type InvoiceAdjustment = {
  label: string;
  amount: number;
  negative?: boolean;
};

export type InvoiceDocumentModel = {
  kind: InvoiceKind;
  invoiceNumber: string;
  date: string;
  partyLabel: string;
  party: string;
  contact?: string;
  lines: InvoiceLine[];
  adjustments: InvoiceAdjustment[];
  total: number;
  paymentSummary: string;
  note?: string;
};

type DatedInvoiceRecord = { id: string; date: string; createdAt?: string };

function getDateCode(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1].slice(-2)}${match[2]}${match[3]}`;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "000000";
  return `${String(parsed.getFullYear()).slice(-2)}${String(parsed.getMonth() + 1).padStart(2, "0")}${String(parsed.getDate()).padStart(2, "0")}`;
}

export function formatInvoiceNumber(date: string, sequence = 0) {
  const base = `ZHK-${getDateCode(date)}`;
  return sequence > 0 ? `${base}-${String(sequence + 1).padStart(2, "0")}` : base;
}

function compareRecords(a: DatedInvoiceRecord, b: DatedInvoiceRecord) {
  const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
  const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
  if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
  return a.id.localeCompare(b.id);
}

export function createInvoiceNumber(date: string, records: DatedInvoiceRecord[]) {
  const sequence = records.filter((record) => record.date === date).length;
  return formatInvoiceNumber(date, sequence);
}

export function getInvoiceNumber(record: DatedInvoiceRecord, records: DatedInvoiceRecord[]) {
  const sameDay = records.filter((item) => item.date === record.date).sort(compareRecords);
  const sequence = Math.max(0, sameDay.findIndex((item) => item.id === record.id));
  return formatInvoiceNumber(record.date, sequence);
}

export function getInvoiceKindLabel(kind: InvoiceKind) {
  return kind === "sale" ? "Sale" : kind === "purchase" ? "Purchase" : "Expense";
}

export function buildInvoiceModel(kind: InvoiceKind, record: InvoiceRecord, invoiceNumber: string): InvoiceDocumentModel {
  if (kind === "expense") {
    const expense = record as Expense;
    return {
      kind,
      invoiceNumber,
      date: expense.date,
      partyLabel: "Expense",
      party: expense.description,
      lines: [{ name: expense.description, detail: expense.category, quantity: 1, unitPrice: expense.amount, discount: 0, amount: expense.amount }],
      adjustments: [{ label: "Subtotal", amount: expense.amount }],
      total: expense.amount,
      paymentSummary: `Paid by: ${expense.paymentMethod || "Other"}`,
      note: expense.note,
    };
  }

  const transaction = record as Transaction;
  if (kind === "purchase") {
    const unitPrice = transaction.unitCost ?? (transaction.quantity ? transaction.amount / transaction.quantity : transaction.amount);
    const outstanding = transaction.outstandingAmount ?? Math.max(0, transaction.amount - (transaction.paidAmount ?? 0));
    return {
      kind,
      invoiceNumber,
      date: transaction.date,
      partyLabel: "Supplier",
      party: transaction.party,
      contact: transaction.supplierContactNumber,
      lines: [{ name: transaction.name, detail: transaction.supplierCompany, quantity: transaction.quantity, unitPrice, discount: 0, amount: transaction.amount }],
      adjustments: [{ label: "Subtotal", amount: transaction.amount }],
      total: transaction.amount,
      paymentSummary: outstanding > 0 ? `Paid at purchase: ${formatCurrency(transaction.paidAmount ?? 0)} · Due: ${formatCurrency(outstanding)}` : "Paid in full",
      note: "Supplier payments are tracked separately from this purchase record.",
    };
  }

  const items = getTransactionItems(transaction);
  const lines = items.length ? items.map((item) => ({ name: item.name, detail: [item.sku, item.color].filter(Boolean).join(" · "), quantity: item.quantity, unitPrice: item.unitSellingPrice, discount: item.discount, amount: item.amount })) : [{ name: transaction.name, quantity: transaction.quantity, unitPrice: transaction.quantity ? transaction.amount / transaction.quantity : transaction.amount, discount: 0, amount: transaction.amount }];
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discount = lines.reduce((sum, line) => sum + line.discount, 0);
  const tradeInCredit = transaction.tradeInCredit ?? 0;
  const total = transaction.amountDue ?? transaction.amount;
  const adjustments: InvoiceAdjustment[] = [{ label: "Subtotal", amount: subtotal }];
  if (discount > 0) adjustments.push({ label: "Discount", amount: discount, negative: true });
  if (tradeInCredit > 0) adjustments.push({ label: "Trade-in credit", amount: tradeInCredit, negative: true });
  return {
    kind,
    invoiceNumber,
    date: transaction.date,
    partyLabel: "Bill to",
    party: transaction.party,
    contact: transaction.customerContactNumber,
    lines,
    adjustments,
    total,
    paymentSummary: total > 0 && (transaction.amountDue ?? transaction.outstandingAmount ?? 0) > 0 ? `Amount due: ${formatCurrency(transaction.amountDue ?? transaction.outstandingAmount ?? 0)}` : "Paid in full",
  };
}
