"use client";

import { CircleDollarSign, Filter, PackagePlus, Percent, ReceiptText, Search, ShoppingCart, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { KpiCard } from "../../../components/erp/kpi-card";
import { formatCurrency, getMonthOptions, getTransactionItems } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type ReportRow = { id: string; product: string; customerName: string; unitsSold: number; unitMargin: number; totalSales: number; totalSoldCost: number };

function getTransactionGrossProfit(transaction: Parameters<typeof getTransactionItems>[0]) {
  const items = getTransactionItems(transaction);
  return items.length ? items.reduce((sum, item) => sum + item.profit, 0) : transaction.profit ?? 0;
}

export default function ReportsPage() {
  const { transactions, expenses } = useErpStore();
  const monthOptions = useMemo(() => getMonthOptions([...transactions, ...expenses]), [transactions, expenses]);
  const [month, setMonth] = useState("all");
  const [draftMonth, setDraftMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ReportRow | null>(null);

  const periodTransactions = useMemo(() => transactions.filter((transaction) => month === "all" || transaction.month === month), [transactions, month]);
  const periodExpenses = useMemo(() => expenses.filter((expense) => month === "all" || expense.month === month), [expenses, month]);
  const sales = useMemo(() => periodTransactions.filter((transaction) => transaction.type === "sale"), [periodTransactions]);
  const purchases = useMemo(() => periodTransactions.filter((transaction) => transaction.type === "purchase" && transaction.source !== "customer-trade-in"), [periodTransactions]);
  const totalSales = sales.reduce((sum, transaction) => sum + transaction.amount, 0);
  const grossProfit = sales.reduce((sum, transaction) => sum + getTransactionGrossProfit(transaction), 0);
  const totalExpenses = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const totalSoldCost = sales.reduce((sum, transaction) => sum + getTransactionItems(transaction).reduce((lineSum, item) => lineSum + item.quantity * item.unitCost, 0), 0);
  const totalUnitsSold = sales.reduce((sum, transaction) => sum + transaction.quantity, 0);
  const totalPurchases = purchases.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalUnitsPurchased = purchases.reduce((sum, transaction) => sum + transaction.quantity, 0);
  const periodLabel = month === "all" ? "All recorded periods" : monthOptions.find((option) => option.value === month)?.label ?? month;

  const reportRows = useMemo<ReportRow[]>(() => {
    const rowMap = new Map<string, ReportRow>();
    sales.forEach((transaction) => getTransactionItems(transaction).forEach((item) => {
      const key = item.productId || item.sku || item.name;
      const current = rowMap.get(key) ?? { id: key, product: item.name, customerName: "", unitsSold: 0, unitMargin: 0, totalSales: 0, totalSoldCost: 0 };
      current.customerName = [current.customerName, transaction.party].filter(Boolean).filter((name, index, names) => names.indexOf(name) === index).join(", ");
      current.unitsSold += item.quantity;
      current.totalSales += item.amount;
      current.totalSoldCost += item.quantity * item.unitCost;
      current.unitMargin = current.unitsSold > 0 ? (current.totalSales - current.totalSoldCost) / current.unitsSold : 0;
      rowMap.set(key, current);
    }));
    return [...rowMap.values()].sort((a, b) => b.totalSales - a.totalSales);
  }, [sales]);

  const searchedRows = useMemo(() => reportRows.filter((row) => `${row.product} ${row.customerName}`.toLowerCase().includes(search.trim().toLowerCase())), [reportRows, search]);
  const applyMonth = () => { setMonth(draftMonth); setFilterOpen(false); };
  const clearMonth = () => { setMonth("all"); setDraftMonth("all"); };

  return <div className="erp-content reports-page-enter">
    <div className="erp-page-heading">
      <div><p className="erp-eyebrow">Business performance</p><h1 className="erp-page-title">Reports</h1><p className="erp-page-subtitle">Performance for {periodLabel} across sales, purchases, expenses, and profit.</p></div>
      <Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={() => { setDraftMonth(month); setFilterOpen(true); }}><Filter size={14} />Filters</Button>
    </div>

    <div className="kpi-grid inventory-kpis reports-kpis mb-[18px]">
      <KpiCard label="Sales revenue" value={formatCurrency(totalSales)} note={`${sales.length} sale records`} icon={<ShoppingCart size={16} />} tone="success" />
      <KpiCard label="Gross profit" value={formatCurrency(grossProfit)} note="Sales less product costs" icon={<TrendingUp size={16} />} tone={grossProfit >= 0 ? "success" : "error"} />
      <KpiCard label="Net profit / loss" value={formatCurrency(netProfit)} note="Gross profit less expenses" icon={<TrendingUp size={16} />} tone={netProfit >= 0 ? "success" : "error"} />
      <KpiCard label="Profit margin" value={`${totalSales ? ((netProfit / totalSales) * 100).toFixed(1) : "0.0"}%`} note="Net margin after expenses" icon={<Percent size={16} />} tone={netProfit >= 0 ? "success" : "error"} />
      <KpiCard label="Units sold" value={new Intl.NumberFormat("en-PK").format(totalUnitsSold)} note="Items sold in period" icon={<ShoppingCart size={16} />} />
      <KpiCard label="Total sold cost" value={formatCurrency(totalSoldCost)} note="Cost of products sold" icon={<CircleDollarSign size={16} />} tone="error" />
      <KpiCard label="Stock purchases" value={formatCurrency(totalPurchases)} note={`${totalUnitsPurchased} units received`} icon={<PackagePlus size={16} />} tone="error" />
      <KpiCard label="Expenses" value={formatCurrency(totalExpenses)} note="Recorded business costs" icon={<ReceiptText size={16} />} tone="error" />
    </div>

    <div className="solexa-filter-chips">
      {month !== "all" && <FilterChip label={periodLabel} onRemove={clearMonth} />}
      {month !== "all" && <button type="button" className="solexa-filter-clear" onClick={clearMonth}>Clear all</button>}
    </div>

    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or customer..." aria-label="Search product or customer" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear report search"><X size={13} /></button>}</label>

    <section className="erp-card">
      <div className="erp-card-header"><div><h2 className="erp-card-title">Product sales report</h2><p className="erp-card-subtitle">Customer names and margins are shown for {periodLabel.toLowerCase()}.</p></div><ReceiptText size={19} className="text-[var(--primary)]" /></div>
      <DataTable className="inventory-table" data={searchedRows} searchable={false} paginationOnly keyExtractor={(row) => row.id} onRowClick={setSelectedProduct} emptyText="No sales recorded for this period." rowClassName={() => ""} columns={[{ key: "product", header: "Product", width: "17%", sortable: true, accessor: (row) => <span className="font-semibold text-[var(--text-primary)]">{row.product}</span> }, { key: "customerName", header: "Customer name", width: "20%", sortable: true, accessor: (row) => <span className="text-[var(--text-secondary)]">{row.customerName || "—"}</span> }, { key: "unitsSold", header: "Units sold", width: "15%", sortable: true, align: "right" }, { key: "unitMargin", header: "Unit margin", width: "16%", sortable: true, align: "right", accessor: (row) => <span className={row.unitMargin >= 0 ? "value-positive" : "value-negative"}>{formatCurrency(row.unitMargin)}</span> }, { key: "totalSales", header: "Sales revenue", width: "16%", sortable: true, align: "right", accessor: (row) => <span className="font-bold text-[var(--text-primary)]">{formatCurrency(row.totalSales)}</span> }, { key: "totalSoldCost", header: "Total sold cost", width: "16%", sortable: true, align: "right", accessor: (row) => <span className="font-bold text-[var(--text-primary)]">{formatCurrency(row.totalSoldCost)}</span> }]} />
    </section>

    <Modal open={filterOpen} title="Filter reports" description="Choose the month and year used in the report calculations." onClose={() => setFilterOpen(false)}><div className="filter-inline-row p-5"><SelectField label="Month and year" value={draftMonth} searchable searchPlaceholder="Search months..." onChange={(event) => setDraftMonth(event.target.value)}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField><div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button" onClick={applyMonth}>Apply filters</Button></div></div></Modal>
    {selectedProduct && <Modal title={selectedProduct.product} description={`Product report details for ${periodLabel.toLowerCase()}`} onClose={() => setSelectedProduct(null)}><div className="grid grid-cols-2 gap-3 p-5"><InfoRow label="Customer name" value={selectedProduct.customerName || "—"} /><InfoRow label="Units sold" value={String(selectedProduct.unitsSold)} /><InfoRow label="Unit margin" value={formatCurrency(selectedProduct.unitMargin)} tone={selectedProduct.unitMargin >= 0 ? "success" : "danger"} /><InfoRow label="Sales revenue" value={formatCurrency(selectedProduct.totalSales)} /><InfoRow label="Total sold cost" value={formatCurrency(selectedProduct.totalSoldCost)} /><InfoRow label="Gross margin" value={formatCurrency(selectedProduct.totalSales - selectedProduct.totalSoldCost)} tone={selectedProduct.totalSales >= selectedProduct.totalSoldCost ? "success" : "danger"} /></div></Modal>}
  </div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="solexa-filter-chip">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X size={13} /></button></span>; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "success" ? "value-positive" : tone === "danger" ? "value-negative" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
