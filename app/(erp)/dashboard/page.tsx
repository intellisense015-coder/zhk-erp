"use client";

import { ArrowDownLeft, ArrowUpRight, Boxes, CircleDollarSign, PackagePlus, TrendingUp, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Modal } from "../../../components/primitives/primitives";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Skeleton } from "../../../components/primitives/skeleton";
import { formatCompactCurrency, formatCurrency, type Product } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

const localDate = (date: Date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; };
type PaymentLedgerEntry = { id: string; createdAt?: string; date: string; time: string; direction: "in" | "out"; type: "Received" | "Paid"; party: string; amount: number };

export default function DashboardPage() {
  const router = useRouter();
  const { products, transactions, suppliers, supplierPayments } = useErpStore();
  const [today, setToday] = useState<string | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setToday(localDate(new Date())), 0); return () => window.clearTimeout(timer); }, []);
  const stockValue = products.reduce((sum, product) => sum + product.inStockQuantity * product.costPrice, 0);
  const lowStock = products.filter((product) => product.inStockQuantity <= product.reorderLevel);
  const sales = transactions.filter((transaction) => transaction.type === "sale");
  const todaySale = sales.filter((transaction) => today !== null && transaction.date === today).reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSale = sales.reduce((sum, transaction) => sum + transaction.amount, 0);
  const netProfit = sales.reduce((sum, transaction) => sum + (transaction.profit ?? 0), 0);
  const paymentLedger = useMemo<PaymentLedgerEntry[]>(() => {
    const received = transactions.filter((transaction) => transaction.type === "sale").map((transaction) => ({
      id: `sale-payment-${transaction.id}`,
      createdAt: transaction.createdAt,
      date: transaction.date,
      time: transaction.time,
      direction: "in" as const,
      type: "Received" as const,
      party: transaction.party,
      amount: transaction.amountDue ?? transaction.amount,
    }));
    const paid = supplierPayments.map((payment) => ({
      id: payment.id,
      createdAt: payment.createdAt,
      date: payment.date,
      time: payment.time,
      direction: "out" as const,
      type: "Paid" as const,
      party: suppliers.find((supplier) => supplier.id === payment.supplierId)?.name ?? "Supplier",
      amount: payment.amount,
    }));
    return [...received, ...paid].sort((first, second) => ledgerTimestamp(second) - ledgerTimestamp(first));
  }, [supplierPayments, suppliers, transactions]);

  return <div className="erp-content dashboard-page">
    <div className="dashboard-layout">
      <div className="dashboard-primary">
        <div className="kpi-grid erp-dashboard-kpis"><Metric label="Today's Sale" value={formatCompactCurrency(todaySale)} note="Customer sales today" icon={<CircleDollarSign size={17} />} onClick={() => setKpi("today")} /><Metric label="Total Sale" value={formatCompactCurrency(totalSale)} note="All recorded customer sales" icon={<CircleDollarSign size={17} />} onClick={() => setKpi("sales")} /><Metric label="Total Stock Value" value={formatCompactCurrency(stockValue)} note="Current inventory valuation" icon={<PackagePlus size={17} />} onClick={() => setKpi("stock")} /><Metric label="Total Profit" value={formatCompactCurrency(netProfit)} note={`${totalSale ? ((netProfit / totalSale) * 100).toFixed(1) : "0.0"}% gross margin`} icon={<TrendingUp size={17} />} tone="success" onClick={() => setKpi("profit")} /><Metric label="Total Items" value={String(products.length)} note="Active inventory items" icon={<Boxes size={17} />} onClick={() => setKpi("items")} /></div>
    <div className="dashboard-main-grid">
      <section className="erp-card dashboard-activity-card"><div className="dashboard-activity-table-wrap"><table className="dashboard-activity-table dashboard-payment-table"><colgroup><col className="dashboard-col-datetime" /><col className="dashboard-col-payment-type" /><col className="dashboard-col-payment-party" /><col className="dashboard-col-payment-amount" /></colgroup><thead><tr><th scope="col">Datetime</th><th scope="col">Type</th><th scope="col">To / From</th><th scope="col" className="text-right">Amount</th></tr></thead><tbody>{paymentLedger.length ? paymentLedger.map((entry) => <tr key={entry.id}><td className="text-[var(--text-muted)]">{formatPaymentDateTime(entry)}</td><td><span className={`activity-type ${entry.direction === "in" ? "value-positive" : "value-negative"}`}>{entry.direction === "in" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{entry.type}</span></td><td>{entry.direction === "in" ? "Received from" : "Paid to"} {entry.party}</td><td className={`text-right font-bold ${entry.direction === "in" ? "value-positive" : "value-negative"}`}>{entry.direction === "in" ? "+" : "-"}{formatCurrency(entry.amount)}</td></tr>) : <tr><td colSpan={4} className="dashboard-activity-empty">No payments recorded yet.</td></tr>}</tbody></table></div></section>
    </div>
      </div>
      <LowStockCard lowStock={lowStock} onOpen={() => router.push("/low-stock")} />
    </div>
    <Modal open={Boolean(kpi)} title={kpiTitle(kpi)} onClose={() => setKpi(null)}><div className="grid gap-3 p-5">{kpi === "today" && <InfoRow label="Today's sale" value={formatCurrency(todaySale)} tone="success" />}{kpi === "sales" && <InfoRow label="Total sale" value={formatCurrency(totalSale)} tone="success" />}{kpi === "stock" && products.map((product) => <InfoRow key={product.id} label={product.name} value={formatCurrency(product.inStockQuantity * product.costPrice)} />)}{kpi === "profit" && <><InfoRow label="Revenue" value={formatCurrency(totalSale)} /><InfoRow label="Cost basis" value={formatCurrency(totalSale - netProfit)} tone="error" /><InfoRow label="Total profit" value={formatCurrency(netProfit)} tone="success" /></>}{kpi === "items" && <InfoRow label="Total items" value={String(products.length)} />}</div></Modal>
  </div>;
}

function LowStockCard({ lowStock, onOpen }: { lowStock: Product[]; onOpen: () => void }) {
  const { hydrated } = useErpStore();
  return <aside className="soft-card dashboard-low-stock-card">
    <div className="dashboard-low-stock-header">
      <div>
        <h2>Low stock</h2>
        <p>Products below their reorder level</p>
      </div>
      {hydrated ? <span className="dashboard-low-stock-count">{lowStock.length}</span> : <Skeleton className="h-8 w-8 rounded-full" />}
    </div>
    {!hydrated ? (
      <div className="dashboard-low-stock-empty dashboard-low-stock-skeleton"><Skeleton className="h-10 w-10 rounded-xl" /><div><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-2.5 w-44" /></div></div>
    ) : lowStock.length ? (
      <div className="dashboard-low-stock-list">
        <div className="dashboard-low-stock-columns"><span>Product</span><span>Left</span></div>
        {lowStock.map((product) => (
          <div key={product.id} className="dashboard-low-stock-item">
            <span className="dashboard-low-stock-product"><b>{product.name}</b><small>{product.sku}</small></span>
            <b className="dashboard-low-stock-remaining">{product.inStockQuantity} units</b>
          </div>
        ))}
      </div>
    ) : (
      <div className="dashboard-low-stock-empty"><TriangleAlert size={18} /><div><b>Stock is healthy</b><span>No products currently need attention.</span></div></div>
    )}
    <Button variant="danger" onClick={onOpen} className="dashboard-low-stock-action">Open stock alerts</Button>
  </aside>;
}

function kpiTitle(kpi: string | null) { return kpi === "today" ? "Today's Sale" : kpi === "sales" ? "Total Sale" : kpi === "stock" ? "Total Stock Value" : kpi === "profit" ? "Total Profit" : "Total Items"; }
function ledgerTimestamp(entry: PaymentLedgerEntry) { if (entry.createdAt) return new Date(entry.createdAt).getTime(); const parsed = new Date(`${entry.date}T12:00:00`).getTime(); return Number.isNaN(parsed) ? 0 : parsed; }
function formatPaymentDateTime(entry: PaymentLedgerEntry) { const dateTime = entry.createdAt ? new Date(entry.createdAt) : new Date(`${entry.date}T12:00:00`); const date = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "long", year: "numeric" }).format(dateTime); if (!entry.createdAt) return `${date} ${entry.time}`; const time = new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", hour12: true }).format(dateTime).toLowerCase(); return `${date} ${time}`; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "error" | "success" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "error" ? "text-[var(--error)]" : tone === "success" ? "text-[var(--success)]" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
function Metric({ label, value, note, icon, tone = "default", onClick }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "success" | "error"; onClick: () => void }) { return <KpiCard size="dashboard" label={label} value={value} note={note} icon={icon} tone={tone} onClick={onClick} />; }
