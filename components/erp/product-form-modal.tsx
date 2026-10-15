"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../primitives/button";
import { Field, Modal, SelectField } from "../primitives/primitives";
import { categories, type Product } from "../../lib/erp-data";
import { productSchema, type ProductFormValues } from "../../lib/validations";
import { useErpStore } from "../../lib/erp-store";

const emptyProduct: ProductFormValues = { name: "", sku: "", category: "Mobiles", vendorName: "", costPrice: 1, sellingPrice: 1, inStockQuantity: 0, reorderLevel: 5 };

function generatedSku(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16);
  return base ? `${base}-SKU` : "AUTO-SKU";
}

type ProductFormModalProps = { open: boolean; product?: Product | null; onClose: () => void; onSubmit: (values: ProductFormValues) => { ok: true } | { ok: false; message: string } | void; serverError?: string | null };

export function ProductFormModal({ open, product, onClose, onSubmit, serverError }: ProductFormModalProps) {
  const { suppliers } = useErpStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, control } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: product ? product : emptyProduct });
  const productName = useWatch({ control, name: "name" });
  const stockQuantity = useWatch({ control, name: "inStockQuantity" });
  const reorderLevel = useWatch({ control, name: "reorderLevel" });
  const [vendorMode, setVendorMode] = useState<"new" | "existing">("new");
  useEffect(() => {
    reset(product ? { ...product, vendorName: product.vendorName ?? "" } : emptyProduct);
    const existingName = product?.vendorName?.trim().toLowerCase();
    setVendorMode(existingName && suppliers.some((supplier) => supplier.name.trim().toLowerCase() === existingName) ? "existing" : "new");
  }, [product, reset, open, suppliers]);
  useEffect(() => { if (!product) setValue("sku", generatedSku(productName || ""), { shouldValidate: true }); }, [product, productName, setValue]);
  const editing = Boolean(product);
  const currentVendor = useWatch({ control, name: "vendorName" }) || "";
  const vendorNames = Array.from(new Set([...suppliers.map((supplier) => supplier.name), ...(product?.vendorName ? [product.vendorName] : [])]));
  const selectedVendor = vendorMode === "existing" ? currentVendor : "__new_vendor__";
  const showNewVendor = vendorMode === "new";
  const status = Number(stockQuantity || 0) === 0 ? "Out of stock" : Number(stockQuantity || 0) <= Number(reorderLevel || 0) ? "Low stock" : "In stock";
  const statusClass = status === "Out of stock" ? "erp-pill-error" : status === "Low stock" ? "erp-pill-warning" : "erp-pill-success";
  return <Modal open={open} title={editing ? "Edit product" : "Add product"} description={editing ? "Update this SKU without leaving inventory." : "Register a gadget with pricing, stock, and reorder rules."} onClose={onClose}>
    <form onSubmit={handleSubmit((values) => { const result = onSubmit(values); if (result && !result.ok) return; })} className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2">
      {serverError && <p className="rounded-xl bg-[var(--error-glow)] px-4 py-3 text-xs font-bold text-[var(--error)] sm:col-span-2">{serverError}</p>}
      <div className="sm:col-span-2"><Field label="Product name" placeholder="e.g. Nothing Phone (3)" {...register("name")} hint={errors.name?.message} /></div>
      <Field label="SKU" placeholder="Generated automatically" readOnly {...register("sku")} hint={errors.sku?.message} />
      <SelectField label="Category" searchable searchPlaceholder="Search categories..." {...register("category")} hint={errors.category?.message}>{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</SelectField>
      <SelectField label="Vendor" searchable searchPlaceholder="Search vendors..." value={selectedVendor} hint={errors.vendorName?.message} onChange={(event) => { const value = event.target.value; const isNew = value === "__new_vendor__"; setVendorMode(isNew ? "new" : "existing"); setValue("vendorName", isNew ? "" : value, { shouldDirty: true, shouldValidate: true }); }}>
        <option value="__new_vendor__">+ New Vendor</option>
        {vendorNames.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}
      </SelectField>
      {showNewVendor ? <Field label="New vendor name" textOnly placeholder="e.g. Tech Source Ltd." {...register("vendorName")} hint={errors.vendorName?.message} /> : <input type="hidden" {...register("vendorName")} />}
      <Field label="Cost price" type="number" min={1} {...register("costPrice", { valueAsNumber: true })} hint={errors.costPrice?.message} />
      <Field label="Default sale price" type="number" min={1} {...register("sellingPrice", { valueAsNumber: true })} hint={errors.sellingPrice?.message} />
      <Field label="Initial stock" type="number" min={0} {...register("inStockQuantity", { valueAsNumber: true })} hint={errors.inStockQuantity?.message} />
      <Field label="Reorder level" type="number" min={0} {...register("reorderLevel", { valueAsNumber: true })} hint={errors.reorderLevel?.message} />
      <div className="product-status-preview sm:col-span-2"><span>Status</span><strong className={`erp-pill ${statusClass}`}>{status}</strong><small>Calculated from initial stock and reorder level.</small></div>
      <div className="primitive-dialog-actions px-0 pb-0 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{editing ? "Save changes" : "Add product"}</Button></div>
    </form>
  </Modal>;
}
