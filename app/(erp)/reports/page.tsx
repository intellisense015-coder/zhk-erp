"use client";

import { CircleDollarSign, Filter, Percent, ReceiptText, Search, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { KpiCard } from "../../../components/erp/kpi-card";
import { formatCurrency, getMonthOptions, getTransactionItems } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type ReportRow = { id: string; product: string; customerName: string; unitsSold: number; unitMargin: number; totalSoldCost: number };

export default function ReportsPage() {
  const { products, transactions, expenses } = useErpStore();
  const monthOptions = getMonthOptions(transactions);
  const [month, setMonth] = useState("all");
  const [draftMonth, setDraftMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ReportRow | null>(null);

  const periodTransactions = useMemo(() => transactions.filter((transaction) => month === "all" || transaction.month === month), [transactions, month]);
  const sales = useMemo(() => periodTransactions.filter((transaction) => transaction.type === "sale"), [periodTransactions]);
  const totalSale = sales.reduce((sum, transaction) => sum + transaction.amount, 0);
  const profit = sales.reduce((sum, transaction) => sum + (transaction.profit ?? 0), 0);
  const totalExpenses = expenses.filter((expense) => month === "all" || expense.month === month).reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = profit - totalExpenses;
  const totalSoldCost = sales.reduce((sum, transaction) => sum + getTransactionItems(transaction).reduce((lineSum, item) => lineSum + item.quantity * item.unitCost, 0), 0);

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

  const searchedRows = useMemo(() => reportRows.filter((row) => `${row.product} ${row.customerName}`.toLowerCase().includes(search.trim().toLowerCase())), [reportRows, search]);
  const applyMonth = () => { setMonth(draftMonth); setFilterOpen(false); };
  const clearMonth = () => { setMonth("all"); setDraftMonth("all"); };

  return <div className="erp-content reports-page-enter">
    <div className="erp-page-heading">
      <div><h1 className="erp-page-title">Reports</h1></div>
      <Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={() => { setDraftMonth(month); setFilterOpen(true); }}><Filter size={14} />Filters</Button>
    </div>

    <div className="kpi-grid inventory-kpis reports-kpis mb-[18px]">
      <KpiCard label="Gross profit" value={formatCurrency(profit)} note="Sales less product costs" icon={<TrendingUp size={16} />} tone="success" />
      <KpiCard label="Net profit" value={formatCurrency(netProfit)} note="Sales profit less expenses" icon={<TrendingUp size={16} />} tone={netProfit >= 0 ? "success" : "error"} />
      <KpiCard label="Profit margin" value={`${totalSale ? ((netProfit / totalSale) * 100).toFixed(1) : "0.0"}%`} note="Net margin after expenses" icon={<Percent size={16} />} />
      <KpiCard label="Total sold cost" value={formatCurrency(totalSoldCost)} note="Cost of products sold" icon={<CircleDollarSign size={16} />} tone="error" />
      <KpiCard label="Expenses" value={formatCurrency(totalExpenses)} note="Recorded business costs" icon={<ReceiptText size={16} />} tone="error" />
    </div>

    <div className="solexa-filter-chips">
      {month !== "all" && <FilterChip label={monthOptions.find((option) => option.value === month)?.label ?? month} onRemove={clearMonth} />}
      {month !== "all" && <button type="button" className="solexa-filter-clear" onClick={clearMonth}>Clear all</button>}
    </div>

    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or customer..." aria-label="Search product or customer" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear report search"><X size={13} /></button>}</label>

    <section className="erp-card">
      <div className="erp-card-header"><div><h2 className="erp-card-title">Product sales report</h2><p className="erp-card-subtitle">Customer names are shown for the selected reporting period.</p></div><ReceiptText size={19} className="text-[var(--primary)]" /></div>
      <DataTable className="inventory-table" data={searchedRows} searchable={false} paginationOnly keyExtractor={(row) => row.id} onRowClick={setSelectedProduct} emptyText="No sales recorded for this period." rowClassName={() => ""} columns={[{ key: "product", header: "Product", width: "20%", sortable: true, accessor: (row) => <span className="font-semibold text-[var(--text-primary)]">{row.product}</span> }, { key: "customerName", header: "Customer name", width: "20%", sortable: true, accessor: (row) => <span className="text-[var(--text-secondary)]">{row.customerName || "—"}</span> }, { key: "unitsSold", header: "Units sold", width: "20%", sortable: true, align: "right" }, { key: "unitMargin", header: "Unit margin", width: "20%", sortable: true, align: "right", accessor: (row) => <span className={row.unitMargin >= 0 ? "value-positive" : "value-negative"}>{formatCurrency(row.unitMargin)}</span> }, { key: "totalSoldCost", header: "Total sold cost", width: "20%", sortable: true, align: "right", accessor: (row) => <span className="font-bold text-[var(--text-primary)]">{formatCurrency(row.totalSoldCost)}</span> }]} />
    </section>

    <Modal open={filterOpen} title="Filter reports" description="Choose the month used in the report metrics." onClose={() => setFilterOpen(false)}><div className="filter-inline-row p-5"><SelectField label="Month" value={draftMonth} searchable searchPlaceholder="Search months..." onChange={(event) => setDraftMonth(event.target.value)}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField><div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button" onClick={applyMonth}>Apply filters</Button></div></div></Modal>
    {selectedProduct && <Modal title={selectedProduct.product} description="Product report details" onClose={() => setSelectedProduct(null)}><div className="grid grid-cols-2 gap-3 p-5"><InfoRow label="Customer name" value={selectedProduct.customerName || "—"} /><InfoRow label="Units sold" value={String(selectedProduct.unitsSold)} /><InfoRow label="Unit margin" value={formatCurrency(selectedProduct.unitMargin)} tone={selectedProduct.unitMargin >= 0 ? "success" : "danger"} /><InfoRow label="Total sold cost" value={formatCurrency(selectedProduct.totalSoldCost)} /></div></Modal>}
  </div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="solexa-filter-chip">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X size={13} /></button></span>; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "success" ? "value-positive" : tone === "danger" ? "value-negative" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
