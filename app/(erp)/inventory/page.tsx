"use client";

import { PackagePlus, SlidersHorizontal, X, Boxes, CircleDollarSign, AlertTriangle, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { ConfirmDialog, Modal, SelectField } from "../../../components/primitives/primitives";
import { ProductFormModal } from "../../../components/erp/product-form-modal";
import { DataTable } from "../../../components/primitives/table";
import { categories, formatCompactCurrency, formatCurrency, type Product } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";
import type { ProductFormValues } from "../../../lib/validations";

function Status({ product }: { product: Product }) { const label = product.inStockQuantity === 0 ? "Out of stock" : product.inStockQuantity <= product.reorderLevel ? "Low stock" : "In stock"; return <span className={`erp-pill ${label === "In stock" ? "erp-pill-success" : label === "Low stock" ? "erp-pill-warning" : "erp-pill-error"}`}>{label}</span>; }

export default function InventoryPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useErpStore();
  const records = products;
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All status");
  const [draftCategory, setDraftCategory] = useState("All categories");
  const [draftStatus, setDraftStatus] = useState("All status");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [kpi, setKpi] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("modal") === "add") { const timer = window.setTimeout(() => setProductModalOpen(true), 0); return () => window.clearTimeout(timer); } }, []);

  const visible = useMemo(() => records.filter((product) => (category === "All categories" || product.category === category) && (status === "All status" || (status === "Low stock" ? product.inStockQuantity > 0 && product.inStockQuantity <= product.reorderLevel : status === "Out of stock" ? product.inStockQuantity === 0 : product.inStockQuantity > product.reorderLevel))).sort((first, second) => { const rank = (product: Product) => product.inStockQuantity <= product.reorderLevel ? 0 : 1; return rank(first) - rank(second); }), [records, category, status]);
  const stockValue = records.reduce((sum, product) => sum + product.inStockQuantity * product.costPrice, 0);
  const units = records.reduce((sum, product) => sum + product.inStockQuantity, 0);
  const lowStock = records.filter((product) => product.inStockQuantity <= product.reorderLevel).length;
  const searched = useMemo(() => visible.filter((product) => `${product.name} ${product.sku} ${product.category} ${product.vendorName}`.toLowerCase().includes(search.trim().toLowerCase())), [visible, search]);

  const openAddModal = () => { setProductError(null); setEditingProduct(null); setProductModalOpen(true); };
  const openEditModal = (product: Product) => { setProductError(null); setEditingProduct(product); setProductModalOpen(true); };
  const saveProduct = (values: ProductFormValues) => {
    const result = editingProduct ? updateProduct(editingProduct.id, values) : addProduct(values);
    if (!result.ok) { setProductError(result.message); return result; }
    setProductError(null);
    setProductModalOpen(false);
    setEditingProduct(null);
    return result;
  };
  const applyFilters = () => { setCategory(draftCategory); setStatus(draftStatus); setFilterOpen(false); };
  const clearFilters = () => { setCategory("All categories"); setStatus("All status"); setDraftCategory("All categories"); setDraftStatus("All status"); };

  return <div className="erp-content">
    <div className="erp-page-heading"><div><h1 className="erp-page-title">Inventory</h1></div><div className="flex gap-2"><Button variant="secondary" onClick={() => { setDraftCategory(category); setDraftStatus(status); setFilterOpen(true); }}><SlidersHorizontal size={15} />Filters</Button><Button onClick={openAddModal}><PackagePlus size={15} />Add product</Button></div></div>
    <div className="erp-grid-4 inventory-kpis mb-[18px]"><Kpi label="Stock value" value={formatCompactCurrency(stockValue)} note="Current asset valuation" icon={<CircleDollarSign size={16} />} onClick={() => setKpi("stock")} /><Kpi label="Units on hand" value={String(units)} note={`${records.length} active SKUs`} icon={<Boxes size={16} />} onClick={() => setKpi("units")} /><Kpi label="Low stock" value={String(lowStock).padStart(2, "0")} note="Needs reorder" tone="error" icon={<AlertTriangle size={16} />} onClick={() => setKpi("low")} /></div>
    <div className="solexa-filter-chips">{category !== "All categories" && <FilterChip label={category} onRemove={() => { setCategory("All categories"); setDraftCategory("All categories"); }} />}{status !== "All status" && <FilterChip label={status} onRemove={() => { setStatus("All status"); setDraftStatus("All status"); }} />}{(category !== "All categories" || status !== "All status") && <button type="button" className="solexa-filter-clear" onClick={clearFilters}>Clear all</button>}</div>
    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU..." aria-label="Search product or SKU" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Current stock</h2><p className="erp-card-subtitle">Low stock appears first so reorder decisions stay visible.</p></div><Boxes size={19} className="text-[var(--primary)]" /></div><DataTable data={searched} searchable={false} paginationOnly keyExtractor={(product) => product.id} emptyText="No products match these filters." onRowClick={setSelected} rowClassName={() => ""} columns={[{ key: "name", header: "Product", sortable: true, accessor: (product) => <div className="flex items-center gap-3"><span className={`grid h-8 w-8 place-items-center rounded-lg ${product.inStockQuantity <= product.reorderLevel ? "bg-[var(--error-glow)] text-[var(--error)]" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}><PackagePlus size={15} /></span><div><p className={`font-semibold ${product.inStockQuantity <= product.reorderLevel ? "text-[var(--error)]" : "text-[var(--text-primary)]"}`}>{product.name}</p><p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">{product.sku}</p></div></div> }, { key: "category", header: "Category", sortable: true }, { key: "costPrice", header: "Cost price", sortable: true, accessor: (product) => formatCurrency(product.costPrice) }, { key: "sellingPrice", header: "Sale price", sortable: true, accessor: (product) => formatCurrency(product.sellingPrice) }, { key: "inStockQuantity", header: "Stock", sortable: true, accessor: (product) => <span className={product.inStockQuantity <= product.reorderLevel ? "font-bold text-[var(--error)]" : ""}>{product.inStockQuantity} units</span> }, { key: "status", header: "Status", accessor: (product) => <Status product={product} /> }, { key: "actions", header: "Actions", accessor: (product) => <div className="table-row-actions"><Button variant="secondary" onClick={(event) => { event.stopPropagation(); openEditModal(product); }}>Edit</Button><button type="button" className="table-icon-danger" aria-label={`Delete ${product.name}`} onClick={(event) => { event.stopPropagation(); setDeleteTarget(product); }}><Trash2 size={14} /></button></div> }]} /></section>

    <Modal open={filterOpen} title="Filter inventory" description="Choose the catalog records you want to see." onClose={() => setFilterOpen(false)}><div className="p-5"><SelectField label="Category" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField><SelectField label="Stock status" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}><option value="All status">All status</option><option value="In stock">In stock</option><option value="Low stock">Low stock</option><option value="Out of stock">Out of stock</option></SelectField><div className="primitive-dialog-actions px-0 pb-0"><Button variant="secondary" onClick={() => setFilterOpen(false)}>Cancel</Button><Button onClick={applyFilters}>Apply filters</Button></div></div></Modal>
    <Modal open={Boolean(kpi)} title={kpi === "stock" ? "Stock valuation" : kpi === "units" ? "Catalog volume" : "Low stock alerts"} description="Inventory KPI details." onClose={() => setKpi(null)}><div className="grid gap-3 p-5">{kpi === "stock" && records.map((product) => <InfoRow key={product.id} label={product.name} value={formatCurrency(product.inStockQuantity * product.costPrice)} />)}{kpi === "units" && <><InfoRow label="Units on hand" value={String(units)} /><InfoRow label="Active SKUs" value={String(records.length)} /></>}{kpi === "low" && records.filter((product) => product.inStockQuantity <= product.reorderLevel).map((product) => <InfoRow key={product.id} label={product.name} value={`${product.inStockQuantity} units`} tone="error" />)}</div></Modal>
    <ProductFormModal open={productModalOpen} product={editingProduct} onClose={() => { setProductModalOpen(false); setEditingProduct(null); setProductError(null); }} onSubmit={saveProduct} serverError={productError} />
    {selected && <Modal title={selected.name} description={`${selected.category} · ${selected.sku}`} onClose={() => setSelected(null)}><div className="grid grid-cols-2 gap-3 p-5"><Detail label="Cost price" value={formatCurrency(selected.costPrice)} /><Detail label="Sale price" value={formatCurrency(selected.sellingPrice)} /><Detail label="Units on hand" value={String(selected.inStockQuantity)} /><Detail label="Reorder level" value={String(selected.reorderLevel)} /><div className="col-span-2 flex justify-end pt-2"><Button variant="secondary" className="cancel-button" onClick={() => { setSelected(null); setDeleteTarget(selected); }}><Trash2 size={14} />Delete product</Button></div></div></Modal>}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete product?" description={deleteTarget ? `${deleteTarget.name} will be removed from inventory.` : undefined} confirmLabel="Delete product" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteProduct(deleteTarget.id); setDeleteTarget(null); setSelected(null); }} />
  </div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="solexa-filter-chip">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X size={13} /></button></span>; }
function Kpi({ label, value, note, icon, tone = "default", onClick }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "error" | "success"; onClick: () => void }) { return <button type="button" onClick={onClick} className="erp-card erp-metric w-full text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]"><div className="erp-metric-top"><span className={`erp-metric-icon ${tone === "error" ? "!bg-[var(--error-glow)] !text-[var(--error)]" : tone === "success" ? "!bg-[var(--success-glow)] !text-[var(--success)]" : ""}`}>{icon}</span></div><p className="erp-metric-label">{label}</p><p className="erp-metric-value">{value}</p><p className="erp-metric-note">{note}</p></button>; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "error" | "success" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "error" ? "text-[var(--error)]" : tone === "success" ? "text-[var(--success)]" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-[10px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
