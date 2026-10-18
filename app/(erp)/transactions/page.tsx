"use client";

import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Boxes, CircleDollarSign, ClipboardList, Filter, Search, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable, TableBadge } from "../../../components/primitives/table";
import { formatCompactCurrency, formatCurrency, formatTransactionTime, getMonthOptions, getTransactionItems, type Transaction } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

export default function TransactionsPage() {
  const { transactions } = useErpStore();
  const monthOptions = getMonthOptions(transactions);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [month, setMonth] = useState("all");
  const [draftMonth, setDraftMonth] = useState("all");
  const [search, setSearch] = useState("");

  const records = transactions;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((transaction) => {
      const matchesMonth = month === "all" || transaction.month === month;
      const matchesSearch = !query || [transaction.name, transaction.party, transaction.type, transaction.source ?? ""].some((value) => value.toLowerCase().includes(query));
      return matchesMonth && matchesSearch;
    });
  }, [month, records, search]);
  const sales = records.filter((transaction) => transaction.type === "sale");
  const purchases = records.filter((transaction) => transaction.type === "purchase");
  const totalSales = sales.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalPurchases = purchases.reduce((sum, transaction) => sum + transaction.amount, 0);
  const netMovement = totalSales - totalPurchases;

  const applyFilter = () => { setMonth(draftMonth); setFilterOpen(false); };
  const clearFilter = () => { setMonth("all"); setDraftMonth("all"); };

  return <div className="erp-content inventory-page-enter">
    <div className="erp-page-heading"><div><h1 className="erp-page-title">Transactions</h1></div><Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={() => { setDraftMonth(month); setFilterOpen(true); }}><Filter size={14} />Filters</Button></div>
    <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]"><Kpi label="Total transactions" value={String(records.length)} note="Recorded activity" icon={<ClipboardList size={16} />} /><Kpi label="Customer sales" value={formatCompactCurrency(totalSales)} note={`${sales.length} sale records`} icon={<CircleDollarSign size={16} />} tone="success" /><Kpi label="Supplier purchases" value={formatCompactCurrency(totalPurchases)} note={`${purchases.length} purchase records`} icon={<Boxes size={16} />} tone="error" /><Kpi label="Net movement" value={formatCompactCurrency(netMovement)} note="Sales minus purchases" icon={<TrendingUp size={16} />} tone={netMovement >= 0 ? "success" : "error"} /></div>
    <div className="solexa-filter-chips">{month !== "all" && <><span className="solexa-filter-chip">{monthOptions.find((option) => option.value === month)?.label ?? month}<button type="button" onClick={clearFilter} aria-label="Remove month filter"><X size={13} /></button></span><button type="button" className="solexa-filter-clear" onClick={clearFilter}>Clear all</button></>}</div>
    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or party..." aria-label="Search item or party" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">All activity</h2><p className="erp-card-subtitle">{visible.length} records in the selected period</p></div><ClipboardList size={19} className="text-[var(--primary)]" /></div><DataTable className="inventory-table" data={visible} searchable={false} paginationOnly keyExtractor={(transaction) => transaction.id} emptyText="No transactions match these filters." onRowClick={setSelected} columns={[{ key: "type", header: "Type", width: "16.6667%", sortable: true, accessor: (transaction: Transaction) => <TableBadge tone={transaction.type === "sale" ? "success" : transaction.type === "purchase" ? "danger" : "brand"}>{transaction.type === "sale" ? <ArrowUpRight size={12} /> : transaction.type === "purchase" ? <ArrowDownLeft size={12} /> : <ArrowRightLeft size={12} />}{transaction.source === "customer-trade-in" ? "Trade-in" : transaction.type}</TableBadge> }, { key: "name", header: "Item", width: "16.6667%", sortable: true, accessor: (transaction) => <div><div className="font-semibold text-[var(--text-primary)]">{transaction.name}</div>{transaction.type === "sale" && <div className="mt-1 text-[10px] text-[var(--text-muted)]">{getTransactionItems(transaction).length} product{getTransactionItems(transaction).length === 1 ? "" : "s"}</div>}{transaction.type === "transfer" && <div className="mt-1 text-[10px] text-[var(--text-muted)]">{transaction.fromEntity} → {transaction.toEntity}</div>}{transaction.source === "customer-trade-in" && <div className="mt-1 text-[10px] text-[var(--text-muted)]">Customer phone received</div>}</div> }, { key: "party", header: "Party", width: "16.6667%", sortable: true }, { key: "quantity", header: "Qty", width: "16.6667%", sortable: true, align: "right" }, { key: "amount", header: "Amount", width: "16.6667%", sortable: true, align: "right", accessor: (transaction) => <span className={`font-bold ${transaction.type === "sale" ? "value-positive" : transaction.type === "purchase" ? "value-negative" : "text-[var(--primary)]"}`}>{transaction.type === "sale" ? "+" : transaction.type === "purchase" ? "-" : ""}{formatCurrency(transaction.amount)}</span> }, { key: "time", header: "Time", width: "16.6667%", sortable: true, align: "right", accessor: (transaction) => <span className="text-[var(--text-muted)]">{formatTransactionTime(transaction)}</span> }]} /></section>

    <Modal open={filterOpen} title="Filter transactions" description="Choose the month you want to review." onClose={() => setFilterOpen(false)}><div className="filter-inline-row p-5"><SelectField label="Month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField><div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button" onClick={applyFilter}>Apply filters</Button></div></div></Modal>
    <Modal open={Boolean(selected)} title={selected?.name} description={selected ? `${transactionLabel(selected)} · ${formatTransactionTime(selected)}` : undefined} onClose={() => setSelected(null)}>{selected && <TransactionDetail transaction={selected} />}</Modal>
  </div>;
}

function Kpi({ label, value, note, icon, tone = "default" }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "error" | "success" }) { return <KpiCard label={label} value={value} note={note} icon={icon} tone={tone} />; }
function transactionLabel(transaction: Transaction) { return transaction.source === "customer-trade-in" ? "Trade-in" : transaction.type === "sale" ? "Sale" : transaction.type === "purchase" ? "Purchase" : "Transfer"; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function TransactionDetail({ transaction }: { transaction: Transaction }) { const items = getTransactionItems(transaction); return <div className="p-5"><div className="grid grid-cols-2 gap-3"><InfoRow label="Party" value={transaction.party} /><InfoRow label="Quantity" value={String(transaction.quantity)} /><InfoRow label="Amount" value={formatCurrency(transaction.amount)} /><InfoRow label="Profit" value={transaction.profit ? formatCurrency(transaction.profit) : "—"} /></div>{transaction.source === "customer-trade-in" && <div className="mt-4 grid grid-cols-2 gap-3"><InfoRow label="Transaction" value="Customer phone received" /><InfoRow label="Exchange" value={transaction.exchangeId ?? "—"} /></div>}{transaction.type === "transfer" && <div className="mt-4 grid grid-cols-2 gap-3"><InfoRow label="From" value={transaction.fromEntity ?? "—"} /><InfoRow label="To" value={transaction.toEntity ?? "—"} /></div>}{transaction.type === "sale" && items.length > 0 && <div className="mt-4 space-y-2">{items.map((item) => <div key={item.productId} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><div><p className="text-xs font-bold">{item.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{item.sku} · {item.quantity} unit{item.quantity === 1 ? "" : "s"}</p></div><div className="text-right"><p className="text-xs font-bold">{formatCurrency(item.amount)}</p><p className="mt-1 text-[10px] font-bold text-[var(--success)]">+{formatCurrency(item.profit)} profit</p></div></div>)}</div>}</div>; }
