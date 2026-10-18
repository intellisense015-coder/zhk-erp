"use client";

import { Filter, Plus, X, Boxes, CircleDollarSign, AlertTriangle, Search, Trash2, Pencil, TrendingUp, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/primitives/button";
import { ConfirmDialog, Modal, SelectField } from "../../../components/primitives/primitives";
import { ProductFormModal } from "../../../components/erp/product-form-modal";
import { KpiCard } from "../../../components/erp/kpi-card";
import { DataTable } from "../../../components/primitives/table";
import { categories, formatCompactCurrency, formatCurrency, productBrands, type Product } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";
import type { ProductFormValues } from "../../../lib/validations";

function Status({ product }: { product: Product }) { const label = product.inStockQuantity === 0 ? "Out of stock" : product.inStockQuantity <= product.reorderLevel ? "Low stock" : "Healthy"; return <span className={`erp-pill ${label === "Healthy" ? "erp-pill-success" : "erp-pill-error"}`}>{label}</span>; }
function productLabel(product: Product) { const brand = productBrands.find((item) => item.value === product.brand)?.label; return brand && product.model ? `${brand} ${product.model}` : product.name; }

export default function InventoryPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useErpStore();
  const records = products;
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All status");
  const [color, setColor] = useState("All colors");
  const [draftCategory, setDraftCategory] = useState("All categories");
  const [draftStatus, setDraftStatus] = useState("All status");
  const [draftColor, setDraftColor] = useState("All colors");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [kpi, setKpi] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("modal") === "add") { const timer = window.setTimeout(() => setProductModalOpen(true), 0); return () => window.clearTimeout(timer); } }, []);

  const colorOptions = useMemo(() => ["All colors", ...Array.from(new Set(records.map((product) => product.color?.trim()).filter((value): value is string => Boolean(value))).values()).sort((first, second) => first.localeCompare(second))], [records]);
  const visible = useMemo(() => records.filter((product) => (category === "All categories" || product.category === category) && (color === "All colors" || product.color === color) && (status === "All status" || (status === "Low stock" ? product.inStockQuantity > 0 && product.inStockQuantity <= product.reorderLevel : status === "Out of stock" ? product.inStockQuantity === 0 : status === "Healthy" ? product.inStockQuantity > product.reorderLevel : true))).sort((first, second) => { const rank = (product: Product) => product.inStockQuantity <= product.reorderLevel ? 0 : 1; return rank(first) - rank(second); }), [records, category, color, status]);
  const stockValue = records.reduce((sum, product) => sum + product.inStockQuantity * product.costPrice, 0);
  const units = records.reduce((sum, product) => sum + product.inStockQuantity, 0);
  const lowStock = records.filter((product) => product.inStockQuantity <= product.reorderLevel).length;
  const potentialProfit = records.reduce((sum, product) => sum + (product.sellingPrice - product.costPrice) * product.inStockQuantity, 0);
  const searched = useMemo(() => visible.filter((product) => `${productLabel(product)} ${product.name} ${product.color} ${product.sku} ${product.category} ${product.vendorName}`.toLowerCase().includes(search.trim().toLowerCase())), [visible, search]);

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
  const applyFilters = () => { setCategory(draftCategory); setStatus(draftStatus); setColor(draftColor); setFilterOpen(false); };
  const clearFilters = () => { setCategory("All categories"); setStatus("All status"); setColor("All colors"); setDraftCategory("All categories"); setDraftStatus("All status"); setDraftColor("All colors"); };

  return <div className="erp-content inventory-page-enter">
    <div className="erp-page-heading"><div><h1 className="erp-page-title">Inventory</h1></div><div className="flex gap-2"><Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={() => { setDraftCategory(category); setDraftStatus(status); setDraftColor(color); setFilterOpen(true); }}><Filter size={14} />Filters</Button><Button variant="brand" className="inventory-add-product-button font-sans text-sm font-medium text-white min-h-10 px-4 rounded-[15px] gap-2" onClick={openAddModal}><Plus size={14} />Add product</Button></div></div>
    <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]"><Kpi label="Stock value" value={formatCompactCurrency(stockValue)} note="Current asset valuation" icon={<CircleDollarSign size={16} />} onClick={() => setKpi("stock")} /><Kpi label="Units on hand" value={String(units)} note={`${records.length} active SKUs`} icon={<Boxes size={16} />} onClick={() => setKpi("units")} /><Kpi label="Low stock" value={String(lowStock).padStart(2, "0")} note="Needs reorder" tone="error" icon={<AlertTriangle size={16} />} onClick={() => setKpi("low")} /><Kpi label="Potential profit" value={formatCompactCurrency(potentialProfit)} note="If all current stock sells" tone="success" icon={<TrendingUp size={16} />} onClick={() => setKpi("profit")} /></div>
    <div className="solexa-filter-chips">{category !== "All categories" && <FilterChip label={category} onRemove={() => { setCategory("All categories"); setDraftCategory("All categories"); }} />}{status !== "All status" && <FilterChip label={status} onRemove={() => { setStatus("All status"); setDraftStatus("All status"); }} />}{color !== "All colors" && <FilterChip label={color} onRemove={() => { setColor("All colors"); setDraftColor("All colors"); }} />}{(category !== "All categories" || status !== "All status" || color !== "All colors") && <button type="button" className="solexa-filter-clear" onClick={clearFilters}>Clear all</button>}</div>
    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or brand..." aria-label="Search product or brand" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Current stock</h2><p className="erp-card-subtitle">Each row is a product color variant, so stock is tracked independently.</p></div><Boxes size={19} className="text-[var(--primary)]" /></div><DataTable className="inventory-table" data={searched} searchable={false} paginationOnly keyExtractor={(product) => product.id} emptyText="No products match these filters." rowClassName={() => ""} columns={[{ key: "name", header: "Product", width: "16.6667%", sortable: true, accessor: (product) => <div><p className={`font-semibold ${product.inStockQuantity <= product.reorderLevel ? "text-[var(--error)]" : "text-[var(--text-primary)]"}`}>{productLabel(product)}</p></div> }, { key: "color", header: "Color", width: "16.6667%", sortable: true, accessor: (product) => <span className="font-medium text-[var(--text-secondary)]">{product.color || "Unspecified"}</span> }, { key: "costPrice", header: "Cost price", width: "16.6667%", sortable: true, accessor: (product) => formatCurrency(product.costPrice) }, { key: "inStockQuantity", header: "Stock", width: "16.6667%", sortable: true, accessor: (product) => <span className={product.inStockQuantity <= product.reorderLevel ? "font-bold text-[var(--error)]" : ""}>{product.inStockQuantity} units</span> }, { key: "status", header: "Status", width: "16.6667%", accessor: (product) => <Status product={product} /> }, { key: "actions", header: "Actions", width: "16.6667%", accessor: (product) => <div className="table-row-actions"><button type="button" className="table-icon-button" aria-label={`View details for ${product.name}`} title="View product details" onClick={() => setDetailProduct(product)}><Eye size={14} /></button><button type="button" className="table-icon-button" aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => openEditModal(product)}><Pencil size={14} /></button><button type="button" className="table-icon-danger" aria-label={`Delete ${product.name}`} title="Delete product" onClick={() => setDeleteTarget(product)}><Trash2 size={14} /></button></div> }]} /></section>

    <Modal open={filterOpen} title="Filter inventory" description="Choose the catalog records you want to see." onClose={() => setFilterOpen(false)}><div className="filter-inline-row p-5"><SelectField label="Category" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField><SelectField label="Stock status" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}><option value="All status">All status</option><option value="Healthy">Healthy</option><option value="Low stock">Low stock</option><option value="Out of stock">Out of stock</option></SelectField><SelectField label="Color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)}>{colorOptions.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField><div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button" onClick={applyFilters}>Apply filters</Button></div></div></Modal>
    <Modal open={Boolean(kpi)} title={kpi === "stock" ? "Stock valuation" : kpi === "units" ? "Catalog volume" : kpi === "profit" ? "Potential profit" : "Low stock alerts"} description="Inventory KPI details." onClose={() => setKpi(null)}><div className="grid gap-3 p-5">{kpi === "stock" && records.map((product) => <InfoRow key={product.id} label={`${product.name} · ${product.color || "Unspecified"}`} value={formatCurrency(product.inStockQuantity * product.costPrice)} />)}{kpi === "units" && <><InfoRow label="Units on hand" value={String(units)} /><InfoRow label="Active SKUs" value={String(records.length)} /></>}{kpi === "profit" && <InfoRow label="Estimated gross profit" value={formatCurrency(potentialProfit)} tone={potentialProfit >= 0 ? "success" : "error"} />}{kpi === "low" && records.filter((product) => product.inStockQuantity <= product.reorderLevel).map((product) => <InfoRow key={product.id} label={`${product.name} · ${product.color || "Unspecified"}`} value={`${product.inStockQuantity} units`} tone="error" />)}</div></Modal>
    <Modal open={Boolean(detailProduct)} title={detailProduct ? `${productLabel(detailProduct)} details` : "Product details"} description={detailProduct ? `${detailProduct.color || "Unspecified"} · ${detailProduct.sku}` : undefined} onClose={() => setDetailProduct(null)} className="product-details-modal-card">{detailProduct && <ProductDetails product={detailProduct} />}</Modal>
    <ProductFormModal key={`${productModalOpen ? "open" : "closed"}-${editingProduct?.id ?? "new"}`} open={productModalOpen} product={editingProduct} onClose={() => { setProductModalOpen(false); setEditingProduct(null); setProductError(null); }} onSubmit={saveProduct} serverError={productError} />
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete product?" description={deleteTarget ? `${deleteTarget.name} will be removed from inventory.` : undefined} confirmLabel="Delete product" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteProduct(deleteTarget.id); setDeleteTarget(null); }} />
  </div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="solexa-filter-chip">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X size={13} /></button></span>; }
function Kpi({ label, value, note, icon, tone = "default", onClick }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: "default" | "error" | "success"; onClick: () => void }) { return <KpiCard label={label} value={value} note={note} icon={icon} tone={tone} onClick={onClick} />; }
function InfoRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "error" | "success" }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className={`text-sm font-bold ${tone === "error" ? "text-[var(--error)]" : tone === "success" ? "text-[var(--success)]" : "text-[var(--text-primary)]"}`}>{value}</span></div>; }
function ProductDetails({ product }: { product: Product }) {
  return <div className="product-details-modal">
    <ProductDetailsSection title="Product information"><DetailItem label="Product" value={productLabel(product)} /><DetailItem label="Color" value={product.color || "Unspecified"} /><DetailItem label="Category" value={product.category} /></ProductDetailsSection>
    <ProductDetailsSection title="Supplier information"><DetailItem label="Supplier" value={product.vendorName || "Unassigned"} /><DetailItem label="Supplier contact" value={product.vendorContactNumber || "Not provided"} /><DetailItem label="Company" value={product.vendorCompany || "Not provided"} /></ProductDetailsSection>
    <ProductDetailsSection title="Inventory information"><DetailItem label="SKU" value={product.sku} /><DetailItem label="Current stock" value={`${product.inStockQuantity} units`} /><DetailItem label="Reorder level" value={`${product.reorderLevel} units`} /></ProductDetailsSection>
    <ProductDetailsSection title="Pricing and description"><DetailItem label="Cost price" value={formatCurrency(product.costPrice)} /><DetailItem label="Sale price" value={formatCurrency(product.sellingPrice)} /><DetailItem label="Description" value={product.description || "No description provided"} /></ProductDetailsSection>
  </div>;
}
function ProductDetailsSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="product-details-section"><h3>{title}</h3><div className="product-details-grid">{children}</div></section>; }
function DetailItem({ label, value }: { label: string; value: string }) { return <div className="product-detail-item"><span>{label}</span><strong>{value}</strong></div>; }
