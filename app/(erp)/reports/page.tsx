"use client";

import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, getMonthOptions, getTransactionItems } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type ReportRow = { id: string; product: string; customerName: string; unitsSold: number; unitMargin: number; totalSoldCost: number };

export default function ReportsPage() {
  const { products, transactions } = useErpStore();
  const monthOptions = getMonthOptions(transactions);
  const [month, setMonth] = useState("all");
  const [draftMonth, setDraftMonth] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ReportRow | null>(null);
  const periodTransactions = useMemo(() => transactions.filter((transaction) => month === "all" || transaction.month === month), [transactions, month]);
  const sales = useMemo(() => periodTransactions.filter((transaction) => transaction.type === "sale"), [periodTransactions]);
  const totalSale = sales.reduce((sum, transaction) => sum + transaction.amount, 0);
  const profit = sales.reduce((sum, transaction) => sum + (transaction.profit ?? 0), 0);
  const totalSoldCost = sales.reduce((sum, transaction) => sum + getTransactionItems(transaction).reduce((lineSum, item) => lineSum + item.quantity * item.unitCost, 0), 0);
  const profitMargin = totalSale ? (profit / totalSale) * 100 : 0;
  const reportRows = useMemo<ReportRow[]>(() => {
    const rowMap = new Map<string, ReportRow>();
    sales.forEach((transaction) => getTransactionItems(transaction).forEach((item) => {
      const key = item.productId || item.sku || item.name;
      const current = rowMap.get(key) ?? { id: key, product: item.name, customerName: "", unitsSold: 0, unitMargin: item.unitSellingPrice - item.unitCost, totalSoldCost: 0 };
      current.customerName = [current.customerName, transaction.party].filter(Boolean).filter((name, index, names) => names.indexOf(name) === index).join(", ");
      current.unitsSold += item.quantity;
      current.totalSoldCost += item.quantity * item.unitCost;
      rowMap.set(key, current);
    }));
    if (rowMap.size) return [...rowMap.values()].sort((a, b) => b.totalSoldCost - a.totalSoldCost);
    return products.map((product) => ({ id: product.id, product: product.name, customerName: "—", unitsSold: 0, unitMargin: product.sellingPrice - product.costPrice, totalSoldCost: 0 }));
  }, [products, sales]);
  const applyMonth = () => { setMonth(draftMonth); setFilterOpen(false); };
  const clearMonth = () => { setMonth("all"); setDraftMonth("all"); };
  return <div className="erp-content"><div className="erp-page-heading"><div><p className="erp-eyebrow">Performance overview</p><h1 className="erp-page-title">Reports</h1><p className="erp-page-subtitle">Review product profitability and sales performance.</p></div><Button variant="secondary" onClick={() => { setDraftMonth(month); setFilterOpen(true); }}><Filter size={15} />Filters</Button></div>{month !== "all" && <div className="mb-4 flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--primary)]">{monthOptions.find((option) => option.value === month)?.label ?? month}<button type="button" onClick={clearMonth} aria-label="Remove month filter"><X size={13} /></button></span></div>}<div className="erp-grid-4 report-kpis"><ReportCard label="Profit margin" value={`${profitMargin.toFixed(1)}%`} /><ReportCard label="Profit" value={formatCurrency(profit)} tone="success" /><ReportCard label="Total sold cost" value={formatCurrency(totalSoldCost)} tone="error" /><ReportCard label="Total sale" value={formatCurrency(totalSale)} /></div><section className="erp-card mt-[18px]"><div className="erp-card-header"><div><h2 className="erp-card-title">Product sales report</h2><p className="erp-card-subtitle">Customer names are shown for the selected reporting period.</p></div></div><DataTable data={reportRows} keyExtractor={(row) => row.id} onRowClick={setSelectedProduct} paginationOnly searchPlaceholder="Search product or customer..." searchKeys={["product", "customerName"]} emptyText="No sales recorded for this period." columns={[{ key: "product", header: "Product", accessor: (row) => <span className="font-semibold text-[var(--text-primary)]">{row.product}</span> }, { key: "customerName", header: "Customer name", accessor: (row) => <span className="text-[var(--text-secondary)]">{row.customerName || "—"}</span> }, { key: "unitsSold", header: "Units sold", align: "right" }, { key: "unitMargin", header: "Unit margin", align: "right", accessor: (row) => <span className={row.unitMargin >= 0 ? "value-positive" : "value-negative"}>{formatCurrency(row.unitMargin)}</span> }, { key: "totalSoldCost", header: "Total sold cost", align: "right", accessor: (row) => <span className="font-bold text-[var(--text-primary)]">{formatCurrency(row.totalSoldCost)}</span> }]} /></section><Modal open={filterOpen} title="Filter reports" description="Choose the month used in the report metrics." onClose={() => setFilterOpen(false)}><div className="p-5"><SelectField label="Month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField><div className="primitive-dialog-actions px-0 pb-0"><Button variant="secondary" className="cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button onClick={applyMonth}>Apply filters</Button></div></div></Modal>{selectedProduct && <Modal title={selectedProduct.product} description="Product report details" onClose={() => setSelectedProduct(null)}><div className="grid grid-cols-2 gap-3 p-5"><InfoRow label="Customer name" value={selectedProduct.customerName || "—"} /><InfoRow label="Units sold" value={String(selectedProduct.unitsSold)} /><InfoRow label="Unit margin" value={formatCurrency(selectedProduct.unitMargin)} tone={selectedProduct.unitMargin >= 0 ? "success" : "danger"} /><InfoRow label="Total sold cost" value={formatCurrency(selectedProduct.totalSoldCost)} /></div></Modal>}</div>;
}

function ReportCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "error" | "success" }) { return <div className={`erp-card erp-metric report-kpi-card ${tone === "error" ? "report-kpi-error" : tone === "success" ? "report-kpi-success" : ""}`}><p className="erp-metric-label">{label}</p><p className="erp-metric-value">{value}</p></div>; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "success" ? "value-positive" : tone === "danger" ? "value-negative" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
