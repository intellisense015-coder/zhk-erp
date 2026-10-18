"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../primitives/button";
import { Field, Modal, SelectField } from "../primitives/primitives";
import { useErpStore } from "../../lib/erp-store";
import { purchaseSchema, type PurchaseFormValues } from "../../lib/validations";
import { formatCurrency, productBrands } from "../../lib/erp-data";

type PurchaseFormModalProps = { open: boolean; onClose: () => void; onSubmit: (values: PurchaseFormValues) => void; onAddProduct?: () => void };

export function PurchaseFormModal({ open, onClose, onSubmit, onAddProduct }: PurchaseFormModalProps) {
  const { products, suppliers, hydrated } = useErpStore();
  const defaultValues = useMemo<PurchaseFormValues>(() => ({ supplierId: "", vendorName: "", supplierContactNumber: "", supplierCompany: "", productId: products[0]?.id ?? "", quantity: 1, unitCost: products[0]?.costPrice ?? 1, paidAmount: 0 }), [products]);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, control } = useForm<PurchaseFormValues>({ resolver: zodResolver(purchaseSchema), defaultValues });
  const supplierId = useWatch({ control, name: "supplierId" }) || "";
  const productId = useWatch({ control, name: "productId" }) || "";
  const quantity = Number(useWatch({ control, name: "quantity" }) || 0);
  const unitCost = Number(useWatch({ control, name: "unitCost" }) || 0);
  const total = quantity * unitCost;
  useEffect(() => { if (open) reset(defaultValues); }, [open, reset, defaultValues]);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const isNewSupplier = !selectedSupplier;
  const productOptionLabel = (product: (typeof products)[number]) => {
    const brand = productBrands.find((item) => item.value === product.brand)?.label ?? "Other brand";
    const model = product.model || product.name;
    return `${brand} · ${product.category} · ${model} · ${product.color || "Unspecified"}`;
  };
  return <Modal open={open} loading={!hydrated} title="Add stock" description="Record incoming supplier stock and its payment status." onClose={onClose}>
    {!products.length ? <div className="p-5"><p className="text-sm font-semibold text-[var(--text-primary)]">Add a product first</p><p className="mt-1 text-xs text-[var(--text-muted)]">Stock entries need an inventory product to attach to.</p></div> :
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2">
      <SelectField label="Item" searchable searchPlaceholder="Search brand, category, or model..." value={productId} hint={errors.productId?.message} onChange={(event) => { if (event.target.value === "__new_product__") { onAddProduct?.(); return; } const product = products.find((item) => item.id === event.target.value); setValue("productId", event.target.value, { shouldValidate: true }); if (product) setValue("unitCost", product.costPrice, { shouldValidate: true }); }}><option value="__new_product__">+ New Product</option>{products.map((product) => <option key={product.id} value={product.id}>{productOptionLabel(product)}</option>)}</SelectField>
      <SelectField label="Supplier" searchable searchPlaceholder="Search suppliers..." value={supplierId || "__new_supplier__"} hint={errors.vendorName?.message || errors.supplierContactNumber?.message} onChange={(event) => { const value = event.target.value; if (value === "__new_supplier__") { setValue("supplierId", "", { shouldDirty: true }); setValue("vendorName", "", { shouldValidate: true }); setValue("supplierContactNumber", "", { shouldValidate: true }); setValue("supplierCompany", ""); } else { const supplier = suppliers.find((item) => item.id === value); setValue("supplierId", value, { shouldDirty: true }); setValue("vendorName", supplier?.name ?? "", { shouldValidate: true }); setValue("supplierContactNumber", supplier?.contactNumber ?? "", { shouldValidate: true }); setValue("supplierCompany", supplier?.company ?? ""); } }}>
        <option value="__new_supplier__">+ New Supplier</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.company ? ` · ${supplier.company}` : ""}</option>)}
      </SelectField>
      {isNewSupplier ? <>
        <Field label="Full name" placeholder="e.g. Ahmed Khan" {...register("vendorName")} hint={errors.vendorName?.message} />
        <Field label="Contact" placeholder="e.g. 0300 1234567" {...register("supplierContactNumber")} hint={errors.supplierContactNumber?.message} />
        <Field label="Company (optional)" placeholder="e.g. Wholesale division" {...register("supplierCompany")} hint={errors.supplierCompany?.message} />
      </> : <><input type="hidden" {...register("vendorName")} /><input type="hidden" {...register("supplierContactNumber")} /><input type="hidden" {...register("supplierCompany")} /></>}
      <Field label="Quantity received" type="number" min={1} {...register("quantity", { valueAsNumber: true })} hint={errors.quantity?.message} />
      <Field label="Unit cost" type="number" min={1} {...register("unitCost", { valueAsNumber: true })} hint={errors.unitCost?.message} />
      <Field label="Paid now" type="number" min={0} {...register("paidAmount", { valueAsNumber: true })} hint={errors.paidAmount?.message} />
      <div className="purchase-calculation-card sm:col-span-2"><span>Qty × Unit Cost</span><strong>{quantity} × {formatCurrency(unitCost)}</strong><b>= {formatCurrency(total)}</b></div>
      <div className="primitive-dialog-actions px-0 pb-0 sm:col-span-2"><Button type="button" variant="secondary" className="cancel-button" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" disabled={isSubmitting}>Add stock</Button></div>
    </form>}
  </Modal>;
}
