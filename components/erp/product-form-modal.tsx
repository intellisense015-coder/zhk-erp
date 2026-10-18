"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../primitives/button";
import { Field, Modal, SelectField } from "../primitives/primitives";
import { brandLogoDomains, categories, formatCurrency, getProductColorOptions, productBrands, type Product } from "../../lib/erp-data";
import { productSchema, type ProductFormValues } from "../../lib/validations";
import { useErpStore } from "../../lib/erp-store";

const emptyProduct: ProductFormValues = {
  name: "Apple iPhone 16",
  sku: generatedSku("apple", "iPhone 16", ""),
  brand: "apple",
  model: "iPhone 16",
  color: "Black",
  description: "",
  imageUrl: "",
  imageSource: undefined,
  category: "Mobiles",
  vendorName: "",
  vendorContactNumber: "",
  vendorCompany: "",
  costPrice: 1,
  sellingPrice: 1,
  inStockQuantity: 0,
  reorderLevel: 5,
};

function generatedSku(brand: string, model: string, color = "") {
  const base = `${brand}-${model}-${color}`.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return base ? `${base}-SKU` : "AUTO-SKU";
}

function composedName(brandValue: string, model: string) {
  const brand = productBrands.find((item) => item.value === brandValue);
  const cleanModel = model.trim().replace(new RegExp(`^${brand?.label ?? brandValue}\\s+`, "i"), "");
  return brand?.value === "other" ? cleanModel : `${brand?.label ?? brandValue} ${cleanModel}`.trim();
}

function formatNumberInput(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}

function parseNumberInput(value: string) {
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

type CatalogDevice = { id: string; name: string; brand: string; category: string; imageUrl?: string; colors: string[] };

function BrandOption({ brand }: { brand: (typeof productBrands)[number] }) {
  const domain = brand.value === "other" ? undefined : brandLogoDomains[brand.value];
  const simpleIconSlug = brand.value === "other" ? "box" : brand.value;
  const logoSources = [
    ...(domain ? [`https://logo.clearbit.com/${domain}`] : []),
    `https://cdn.simpleicons.org/${simpleIconSlug}`,
  ];
  const [logoIndex, setLogoIndex] = useState(0);
  const hasLogo = logoIndex < logoSources.length;
  const logoUrl = logoSources[logoIndex];

  return <span className="product-brand-option"><span className={`product-brand-logo ${hasLogo ? "" : "product-brand-fallback"}`}>{hasLogo ? <img src={logoUrl} alt={`${brand.label} logo`} aria-hidden="true" onError={() => setLogoIndex((current) => current + 1)} /> : brand.mark}</span><span>{brand.label}</span></span>;
}

type ProductFormModalProps = { open: boolean; product?: Product | null; onClose: () => void; onSubmit: (values: ProductFormValues) => { ok: true } | { ok: false; message: string } | void; serverError?: string | null };

export function ProductFormModal({ open, product, onClose, onSubmit, serverError }: ProductFormModalProps) {
  const { suppliers, hydrated } = useErpStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, control } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: product ? { ...product, brand: product.brand ?? "other", model: product.model ?? product.name, vendorName: product.vendorName ?? "", vendorContactNumber: product.vendorContactNumber ?? "", vendorCompany: product.vendorCompany ?? "", imageUrl: product.imageUrl ?? "", imageSource: product.imageSource } : emptyProduct });
  const brandValue = useWatch({ control, name: "brand" }) || emptyProduct.brand;
  const modelValue = useWatch({ control, name: "model" }) || "";
  const colorValue = useWatch({ control, name: "color" }) || "";
  const categoryValue = useWatch({ control, name: "category" }) || emptyProduct.category;
  const currentVendor = useWatch({ control, name: "vendorName" }) || "";
  const costPrice = Number(useWatch({ control, name: "costPrice" }) || 0);
  const sellingPrice = Number(useWatch({ control, name: "sellingPrice" }) || 0);
  const quantity = Number(useWatch({ control, name: "inStockQuantity" }) || 0);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [catalogModels, setCatalogModels] = useState<CatalogDevice[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"idle" | "ready" | "fallback">("idle");
  const selectedBrand = productBrands.find((item) => item.value === brandValue) ?? productBrands[0];
  const catalogModel = catalogModels.find((item) => item.name.toLowerCase() === modelValue.toLowerCase());
  const modelsForSelection = Array.from(new Map([
    ...selectedBrand.models.filter((item) => item.category === categoryValue).map((item) => [item.name.toLowerCase(), item] as const),
    ...catalogModels.filter((item) => item.category === categoryValue).map((item) => [item.name.toLowerCase(), { name: item.name, category: item.category }] as const),
  ]).values());
  const colorOptions = Array.from(new Set([...(catalogModel?.colors ?? []), ...getProductColorOptions(brandValue, modelValue, categoryValue, colorValue)]));
  const vendorNames = Array.from(new Set([...suppliers.map((supplier) => supplier.name), ...(product?.vendorName ? [product.vendorName] : [])]));
  const selectedVendor = suppliers.some((supplier) => supplier.name.trim().toLowerCase() === currentVendor.trim().toLowerCase()) ? currentVendor : "__new_vendor__";
  const showNewVendor = selectedVendor === "__new_vendor__";
  const totalCost = costPrice * quantity;
  const perPieceProfit = sellingPrice - costPrice;
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supplier = product?.vendorName ? suppliers.find((item) => item.name.trim().toLowerCase() === product.vendorName?.trim().toLowerCase()) : undefined;
    reset(product ? { ...product, brand: product.brand ?? "other", model: product.model ?? product.name, color: product.color ?? "Unspecified", vendorName: product.vendorName ?? "", vendorContactNumber: product.vendorContactNumber ?? supplier?.contactNumber ?? "", vendorCompany: product.vendorCompany ?? supplier?.company ?? "", imageUrl: product.imageUrl ?? "", imageSource: product.imageSource } : emptyProduct);
  }, [product, reset, open, suppliers]);

  useEffect(() => {
    setValue("name", composedName(brandValue, modelValue), { shouldValidate: true });
    setValue("sku", generatedSku(brandValue, modelValue, colorValue), { shouldValidate: true });
  }, [brandValue, modelValue, colorValue, setValue]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    fetch(`/api/device-catalog?manufacturer=${encodeURIComponent(selectedBrand.label)}&category=${encodeURIComponent(categoryValue)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { devices?: CatalogDevice[]; configured?: boolean };
        if (!response.ok || !payload.configured) throw new Error("Remote catalog is not configured");
        setCatalogModels(payload.devices ?? []);
        setCatalogStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogModels([]);
        setCatalogStatus("fallback");
      });
    return () => controller.abort();
  }, [categoryValue, open, selectedBrand.label]);

  useEffect(() => {
    if (!catalogModel) return;
    setValue("imageUrl", catalogModel.imageUrl ?? "", { shouldDirty: false });
    setValue("imageSource", catalogModel.imageUrl ? "catalog" : undefined, { shouldDirty: false });
    if (catalogModel.colors.length && !catalogModel.colors.includes(colorValue)) setValue("color", catalogModel.colors[0], { shouldDirty: false, shouldValidate: true });
  }, [catalogModel, colorValue, setValue]);

  useEffect(() => {
    if (!open || !modelValue || !selectedBrand.label) return undefined;
    const controller = new AbortController();
    fetch(`/api/device-catalog?manufacturer=${encodeURIComponent(selectedBrand.label)}&category=${encodeURIComponent(categoryValue)}&model=${encodeURIComponent(modelValue)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { devices?: CatalogDevice[] };
        const device = payload.devices?.[0];
        if (response.ok && device?.imageUrl) {
          setValue("imageUrl", device.imageUrl, { shouldDirty: false });
          setValue("imageSource", "catalog", { shouldDirty: false });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [categoryValue, modelValue, open, selectedBrand.label, setValue]);

  const editing = Boolean(product);
  const submit = (values: ProductFormValues) => {
    setFormError(null);
    if (showNewVendor && !values.vendorContactNumber.trim()) {
      setVendorError("A unique supplier contact number is required for a new supplier.");
      return;
    }
    setVendorError(null);
    onSubmit(values);
  };
  const handleInvalid = (formErrors: FieldErrors<ProductFormValues>) => {
    const firstMessage = Object.values(formErrors).map((error) => error?.message).find((message): message is string => typeof message === "string" && message !== "Supplier is required");
    setFormError(firstMessage ?? null);
  };

  return <Modal open={open} loading={!hydrated} title={editing ? "Edit product" : "Add product"} description={editing ? "Update this product without leaving inventory." : "Register a product with pricing, stock, and reorder rules."} onClose={onClose} className="product-form-modal">
    <form onSubmit={handleSubmit(submit, handleInvalid)} className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2">
      {formError && <p role="alert" className="rounded-xl bg-[var(--error-glow)] px-4 py-3 text-xs font-bold text-[var(--error)] sm:col-span-2">{formError}</p>}
      {serverError && <p className="rounded-xl bg-[var(--error-glow)] px-4 py-3 text-xs font-bold text-[var(--error)] sm:col-span-2">{serverError}</p>}
      <input type="hidden" {...register("name")} />
      <input type="hidden" {...register("sku")} />
      <input type="hidden" {...register("imageUrl")} />
      <input type="hidden" {...register("imageSource")} />

      <section className="product-form-section sm:col-span-2 min-w-0" aria-labelledby="item-title">
        <h3 id="item-title" className="m-0 mb-2 text-[14px] font-bold text-[var(--text-primary)]">Item</h3>
        <div className="product-form-card grid grid-cols-3 items-end gap-2.5 rounded-[16px] max-[620px]:grid-cols-1">
          <SelectField label="Brand" searchable searchPlaceholder="Search brands..." {...register("brand")} value={brandValue} hint={errors.brand?.message} onChange={(event) => {
            const nextBrand = productBrands.find((item) => item.value === event.target.value) ?? productBrands[0];
            const nextModel = nextBrand.models.find((item) => item.category === categoryValue)?.name ?? "";
            setValue("brand", nextBrand.value, { shouldDirty: true, shouldValidate: true });
            setValue("model", nextModel, { shouldDirty: true, shouldValidate: true });
            setValue("imageUrl", "", { shouldDirty: true });
            setValue("imageSource", undefined, { shouldDirty: true });
            setValue("color", getProductColorOptions(nextBrand.value, nextModel, categoryValue)[0] ?? "", { shouldDirty: true, shouldValidate: true });
          }}>{productBrands.map((brand) => <option key={brand.value} value={brand.value}><BrandOption brand={brand} /></option>)}</SelectField>

          <SelectField label="Category" searchable searchPlaceholder="Search categories..." {...register("category")} value={categoryValue} hint={errors.category?.message} onChange={(event) => {
            const nextCategory = event.target.value;
            const nextModel = selectedBrand.models.find((item) => item.category === nextCategory)?.name ?? "";
            setValue("category", nextCategory, { shouldDirty: true, shouldValidate: true });
            setValue("model", nextModel, { shouldDirty: true, shouldValidate: true });
            setValue("imageUrl", "", { shouldDirty: true });
            setValue("imageSource", undefined, { shouldDirty: true });
            setValue("color", getProductColorOptions(brandValue, nextModel, nextCategory)[0] ?? "", { shouldDirty: true, shouldValidate: true });
          }}>{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</SelectField>

          <SelectField label="Model" searchable searchPlaceholder="Search models..." {...register("model")} value={modelValue} hint={errors.model?.message} onChange={(event) => { const nextModel = event.target.value; setValue("model", nextModel, { shouldDirty: true, shouldValidate: true }); setValue("imageUrl", "", { shouldDirty: true }); setValue("imageSource", undefined, { shouldDirty: true }); setValue("color", getProductColorOptions(brandValue, nextModel, categoryValue)[0] ?? "", { shouldDirty: true, shouldValidate: true }); }}>
            {modelsForSelection.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
          </SelectField>
          <div className="col-span-full">
            <SelectField label="Color" searchable searchPlaceholder="Search device colors..." {...register("color")} value={colorValue} hint={errors.color?.message} onChange={(event) => setValue("color", event.target.value, { shouldDirty: true, shouldValidate: true })}>
              {colorOptions.map((color) => <option key={color} value={color}>{color}</option>)}
            </SelectField>
          </div>
          {catalogStatus === "fallback" && <p className="col-span-full m-0 text-[10px] text-[var(--text-muted)]">Showing the built-in catalog while the device catalog is unavailable.</p>}
          <label className="product-modal-compact-label col-span-full block">
            <span className="mb-2 block text-[10px] font-semibold text-[var(--text-primary)]">Description (optional)</span>
            <textarea {...register("description")} rows={3} maxLength={500} placeholder="e.g. 256GB, factory unlocked, with original box" className="floating-input product-description-input w-full rounded-[14px] px-4 py-3 text-[10px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
            {errors.description?.message && <span className="mt-1.5 block text-[10px] text-[var(--error)]">{errors.description.message}</span>}
          </label>
        </div>
      </section>

      <section className="product-form-section sm:col-span-2 min-w-0" aria-labelledby="vendor-title">
        <h3 id="vendor-title" className="m-0 mb-2 text-[12px] font-bold text-[var(--text-primary)]">Supplier</h3>
        <div className="product-form-card grid grid-cols-3 items-end gap-2.5 rounded-[16px] max-[620px]:grid-cols-1">
          <SelectField label="Supplier" searchable searchPlaceholder="Search suppliers..." value={selectedVendor} hint={showNewVendor ? undefined : errors.vendorName?.message} onChange={(event) => {
              const value = event.target.value;
              const supplier = suppliers.find((item) => item.name === value);
              const isNew = value === "__new_vendor__";
              setValue("vendorName", isNew ? "" : value, { shouldDirty: true, shouldValidate: true });
              setValue("vendorContactNumber", isNew ? "" : supplier?.contactNumber ?? "", { shouldDirty: true, shouldValidate: true });
              setValue("vendorCompany", isNew ? "" : supplier?.company ?? "", { shouldDirty: true, shouldValidate: true });
              setVendorError(null);
            }}>
              <option value="__new_vendor__">+ New Supplier</option>
              {vendorNames.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}
          </SelectField>

          {showNewVendor ? <>
            <Field className="product-modal-compact-label" label="Full name" textOnly placeholder="e.g. Ahmed Khan" {...register("vendorName")} hint={errors.vendorName?.message === "Supplier is required" ? undefined : errors.vendorName?.message} />
            <Field className="product-modal-compact-label" label="Contact" type="tel" placeholder="e.g. 0300 1234567" {...register("vendorContactNumber")} hint={errors.vendorContactNumber?.message} />
            <Field className="product-modal-compact-label" label="Company (optional)" textOnly placeholder="e.g. Tech Source (Pvt) Ltd." {...register("vendorCompany")} />
          </> : <><input type="hidden" {...register("vendorName")} /><input type="hidden" {...register("vendorContactNumber")} /><input type="hidden" {...register("vendorCompany")} /></>}
        </div>
      </section>

      <section className="product-calculation-section mt-2 min-w-0 sm:col-span-2" aria-labelledby="costing-title">
        <h3 id="costing-title" className="m-0 mb-2 text-[12px] font-bold text-[var(--text-primary)]">Costing</h3>
        <div className="product-calculation-card grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-end rounded-[16px] max-[520px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" aria-live="polite">
          <label className="product-calculation-field block min-w-0"><span>Per piece cost</span><Controller name="costPrice" control={control} render={({ field }) => <input {...field} className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] text-[var(--text-primary)] outline-none" type="text" inputMode="decimal" value={formatNumberInput(Number(field.value) || 0)} onChange={(event) => field.onChange(parseNumberInput(event.target.value))} aria-label="Per piece cost" />} />{errors.costPrice?.message && <small>{errors.costPrice.message}</small>}</label>
          <span className="product-calculation-symbol">×</span>
          <label className="product-calculation-field block min-w-0"><span>Quantity</span><input {...register("inStockQuantity", { valueAsNumber: true })} className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] text-[var(--text-primary)] outline-none" type="text" inputMode="numeric" value={formatNumberInput(quantity, 0)} onChange={(event) => setValue("inStockQuantity", Math.max(0, Math.floor(parseNumberInput(event.target.value))), { shouldDirty: true, shouldValidate: true })} aria-label="Quantity" />{errors.inStockQuantity?.message && <small>{errors.inStockQuantity.message}</small>}</label>
          <span className="product-calculation-symbol">=</span>
          <label className="product-calculation-field block min-w-0 max-[520px]:col-span-full"><span>Total cost</span><input className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] font-semibold text-[var(--text-primary)] outline-none" value={formatCurrency(totalCost)} readOnly aria-label="Total cost" /></label>
        </div>
      </section>

      <section className="product-calculation-section mt-2 min-w-0 sm:col-span-2" aria-labelledby="profit-title">
        <h3 id="profit-title" className="m-0 mb-2 text-[12px] font-bold text-[var(--text-primary)]">Profit</h3>
        <div className="product-profit-card grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2.5 rounded-[16px] p-3.5 max-[520px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" aria-live="polite">
          <label className="product-calculation-field block min-w-0"><span className="whitespace-nowrap text-[9px]">Default sale price/piece</span><Controller name="sellingPrice" control={control} render={({ field }) => <input {...field} className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] text-[var(--text-primary)] outline-none" type="text" inputMode="decimal" value={formatNumberInput(Number(field.value) || 0)} onChange={(event) => field.onChange(parseNumberInput(event.target.value))} aria-label="Default sale price per piece" />} />{errors.sellingPrice?.message && <small>{errors.sellingPrice.message}</small>}</label>
          <span className="product-calculation-symbol">−</span>
          <label className="product-calculation-field block min-w-0"><span>Per piece cost</span><input className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] font-semibold text-[var(--text-primary)] outline-none" value={formatNumberInput(costPrice)} readOnly aria-label="Per piece cost used for profit" /></label>
          <span className="product-calculation-symbol">=</span>
          <label className="product-calculation-field block min-w-0 max-[520px]:col-span-full"><span>Per piece profit</span><input className={`floating-input h-11 w-full rounded-[14px] px-4 text-[10px] font-semibold outline-none ${perPieceProfit >= 0 ? "value-positive" : "value-negative"}`} value={formatCurrency(perPieceProfit)} readOnly aria-label="Per piece profit" /></label>
        </div>
      </section>
      <Field className="product-modal-compact-label" label="Reorder level" type="number" min={0} {...register("reorderLevel", { valueAsNumber: true })} hint={errors.reorderLevel?.message} />
      {vendorError && <p className="text-[10px] font-bold text-[var(--error)] sm:col-span-2">{vendorError}</p>}
      <div className="primitive-dialog-actions px-0 pb-0 sm:col-span-2"><Button type="button" variant="secondary" className="cancel-button" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" disabled={isSubmitting}>{editing ? "Save changes" : "Add product"}</Button></div>
    </form>
  </Modal>;
}
