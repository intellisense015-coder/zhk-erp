"use client";

import { AlertTriangle, Boxes, CircleDollarSign, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { Button } from "../../../components/primitives/button";
import { DataTable, TableBadge } from "../../../components/primitives/table";
import { categories, formatCompactCurrency, formatCurrency, type Product } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

const severityOptions = [
  { value: "all", label: "All severity" },
  { value: "critical", label: "Out of stock" },
  { value: "attention", label: "Needs reorder" },
];

export default function LowStockPage() {
  const { products } = useErpStore();
  const [category, setCategory] = useState("All categories");
  const [severity, setSeverity] = useState("all");
  const [draftCategory, setDraftCategory] = useState("All categories");
  const [draftSeverity, setDraftSeverity] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);

  const alerts = useMemo(() => products.filter((product) => product.inStockQuantity <= product.reorderLevel && (category === "All categories" || product.category === category) && (severity === "all" || (severity === "critical" ? product.inStockQuantity === 0 : product.inStockQuantity > 0))), [products, category, severity]);
  const searched = useMemo(() => alerts.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase())), [alerts, search]);
  const allLowStockCount = products.filter((product) => product.inStockQuantity <= product.reorderLevel).length;
  const allCriticalCount = products.filter((product) => product.inStockQuantity === 0).length;
  const allUnitsAtRisk = products.filter((product) => product.inStockQuantity <= product.reorderLevel).reduce((sum, product) => sum + product.inStockQuantity, 0);
  const allStockValue = products.filter((product) => product.inStockQuantity <= product.reorderLevel).reduce((sum, product) => sum + product.inStockQuantity * product.costPrice, 0);

  const applyFilters = () => { setCategory(draftCategory); setSeverity(draftSeverity); setFilterOpen(false); };
  const clearFilters = () => { setCategory("All categories"); setSeverity("all"); setDraftCategory("All categories"); setDraftSeverity("all"); };
  const severityLabel = severityOptions.find((option) => option.value === severity)?.label ?? severity;

  return <div className="erp-content inventory-page-enter">
    <div className="erp-page-heading"><div><h1 className="erp-page-title">Low stock</h1></div><Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={() => { setDraftCategory(category); setDraftSeverity(severity); setFilterOpen(true); }}><Filter size={14} />Filters</Button></div>
    <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]"><Kpi label="Low stock items" value={String(allLowStockCount)} note="Products below reorder level" icon={<Boxes size={16} />} /><Kpi label="Critical items" value={String(allCriticalCount)} note="Currently out of stock" icon={<AlertTriangle size={16} />} tone="error" /><Kpi label="Units at risk" value={String(allUnitsAtRisk)} note="Units needing attention" icon={<Boxes size={16} />} /><Kpi label="Stock value" value={formatCompactCurrency(allStockValue)} note="Value of low stock" icon={<CircleDollarSign size={16} />} /></div>
    <div className="solexa-filter-chips">{category !== "All categories" && <FilterChip label={category} onRemove={() => { setCategory("All categories"); setDraftCategory("All categories"); }} />}{severity !== "all" && <FilterChip label={severityLabel} onRemove={() => { setSeverity("all"); setDraftSeverity("all"); }} />}{(category !== "All categories" || severity !== "all") && <button type="button" className="solexa-filter-clear" onClick={clearFilters}>Clear all</button>}</div>
    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU..." aria-label="Search product or SKU" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Reorder queue</h2><p className="erp-card-subtitle">{searched.length} low stock {searched.length === 1 ? "item" : "items"} match the current filters.</p></div><AlertTriangle size={19} className="text-[var(--error)]" /></div><DataTable className="inventory-table" data={searched} searchable={false} paginationOnly keyExtractor={(product) => product.id} onRowClick={setSelected} emptyText="No low stock items match these filters." columns={[{ key: "product", header: "Product", width: "16.6667%", sortable: true, accessor: (product) => <div><span className="font-semibold text-[var(--text-primary)]">{product.name}</span><small className="mt-1 block text-[10px] text-[var(--text-muted)]">{product.sku}</small></div> }, { key: "category", header: "Category", width: "16.6667%", sortable: true }, { key: "current", header: "Current stock", width: "16.6667%", align: "right", accessor: (product) => <span className="font-bold value-negative">{product.inStockQuantity} units</span> }, { key: "reorder", header: "Reorder level", width: "16.6667%", align: "right", sortable: true, accessor: (product) => `${product.reorderLevel} units` }, { key: "shortfall", header: "Shortfall", width: "16.6667%", align: "right", sortable: true, accessor: (product) => <span className="font-bold value-negative">{Math.max(product.reorderLevel - product.inStockQuantity, 0)} units</span> }, { key: "status", header: "Status", width: "16.6667%", accessor: (product) => <TableBadge tone={product.inStockQuantity === 0 ? "danger" : "warning"}>{product.inStockQuantity === 0 ? "Out of stock" : "Needs reorder"}</TableBadge> }]} /></section>

    <Modal open={filterOpen} title="Filter low stock" description="Choose the stock alerts you want to review." onClose={() => setFilterOpen(false)}><div className="filter-inline-row p-5"><SelectField label="Category" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField><SelectField label="Severity" value={draftSeverity} onChange={(event) => setDraftSeverity(event.target.value)}>{severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField><div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="cancel-button !bg-[var(--error)] !text-white" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button inventory-add-product-button !text-white" onClick={applyFilters}>Apply filters</Button></div></div></Modal>
    <Modal open={Boolean(selected)} title={selected?.name} description={selected ? `${selected.category} · ${selected.sku}` : undefined} onClose={() => setSelected(null)}>{selected && <div className="grid grid-cols-2 gap-3 p-5"><Info label="Current stock" value={`${selected.inStockQuantity} units`} tone="danger" /><Info label="Reorder level" value={`${selected.reorderLevel} units`} /><Info label="Stock value" value={formatCurrency(selected.inStockQuantity * selected.costPrice)} /><Info label="Status" value={selected.inStockQuantity === 0 ? "Out of stock" : "Needs reorder"} tone="danger" /></div>}</Modal>
  </div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="solexa-filter-chip">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X size={13} /></button></span>; }
function Kpi({ label, value, note, icon, tone = "default" }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "error" | "success" }) { return <KpiCard label={label} value={value} note={note} icon={icon} tone={tone} />; }
function Info({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) { return <div className="rounded-xl bg-[var(--surface-soft)] p-3"><span className="block text-[10px] text-[var(--text-muted)]">{label}</span><strong className={`mt-1 block text-sm ${tone === "danger" ? "value-negative" : "text-[var(--text-primary)]"}`}>{value}</strong></div>; }
