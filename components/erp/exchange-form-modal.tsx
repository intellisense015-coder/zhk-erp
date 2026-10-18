"use client";

import { ArrowLeftRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../primitives/button";
import { Field, Modal, SelectField } from "../primitives/primitives";
import { formatCurrency, type Product } from "../../lib/erp-data";
import { useErpStore } from "../../lib/erp-store";
import type { ExchangeFormValues } from "../../lib/validations";

type ExchangeDraft = Omit<ExchangeFormValues, "givenQuantity" | "tradeInUnitValue" | "receivedQuantity" | "receivedUnitSellingPrice" | "supplierUnitCost" | "supplierPaidAmount"> & {
  givenQuantity: string;
  tradeInUnitValue: string;
  receivedQuantity: string;
  receivedUnitSellingPrice: string;
  supplierUnitCost: string;
  supplierPaidAmount: string;
};

function nextCustomerCode(customers: Array<{ code: string }>) {
  let index = customers.length + 1;
  let code = `CUST-${String(index).padStart(3, "0")}`;
  while (customers.some((customer) => customer.code === code)) code = `CUST-${String(++index).padStart(3, "0")}`;
  return code;
}

function buildDraft(products: Product[], customers: Array<{ code: string }>): ExchangeDraft {
  const given = products[0];
  const received = products.find((product) => product.id !== given?.id) ?? given;
  return {
    mode: "exchange",
    customerId: "",
    customerName: "",
    customerContactNumber: "",
    customerCode: nextCustomerCode(customers),
    givenProductId: given?.id ?? "",
    givenQuantity: "1",
    tradeInUnitValue: String(given?.costPrice ?? 0),
    receivedProductId: received?.id ?? "",
    receivedQuantity: "1",
    receivedUnitSellingPrice: String(received?.sellingPrice ?? 0),
    receiveSource: "inventory",
    supplierId: "",
    supplierName: "",
    supplierContactNumber: "",
    supplierCompany: "",
    supplierUnitCost: String(received?.costPrice ?? 0),
    supplierPaidAmount: "0",
  };
}

export function ExchangeFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, customers, suppliers, addExchange } = useErpStore();
  const [draft, setDraft] = useState<ExchangeDraft>(() => buildDraft(products, customers));
  const [error, setError] = useState<string | null>(null);
  const givenProduct = useMemo(() => products.find((product) => product.id === draft.givenProductId), [products, draft.givenProductId]);
  const receivedProduct = useMemo(() => products.find((product) => product.id === draft.receivedProductId), [products, draft.receivedProductId]);
  const tradeInTotal = (Number(draft.givenQuantity) || 0) * (Number(draft.tradeInUnitValue) || 0);
  const saleTotal = (Number(draft.receivedQuantity) || 0) * (Number(draft.receivedUnitSellingPrice) || 0);
  const amountDue = saleTotal - tradeInTotal;
  const isBuyback = draft.mode === "buyback";

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(products, customers));
      setError(null);
    }
  }, [open, products, customers]);

  const update = <K extends keyof ExchangeDraft>(key: K, value: ExchangeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const selectGivenProduct = (id: string) => {
    const product = products.find((item) => item.id === id);
    setDraft((current) => ({ ...current, givenProductId: id, tradeInUnitValue: String(product?.costPrice ?? 0) }));
  };
  const selectReceivedProduct = (id: string) => {
    const product = products.find((item) => item.id === id);
    setDraft((current) => ({ ...current, receivedProductId: id, receivedUnitSellingPrice: String(product?.sellingPrice ?? 0), supplierUnitCost: String(product?.costPrice ?? 0) }));
  };
  const selectCustomer = (id: string) => {
    if (id === "__new_customer__") {
      setDraft((current) => ({ ...current, customerId: "", customerName: "", customerContactNumber: "", customerCode: nextCustomerCode(customers) }));
      return;
    }
    const customer = customers.find((item) => item.id === id);
    if (customer) setDraft((current) => ({ ...current, customerId: customer.id, customerName: customer.name, customerContactNumber: customer.contactNumber, customerCode: customer.code }));
  };
  const selectSupplier = (id: string) => {
    if (!id) {
      setDraft((current) => ({ ...current, supplierId: "", supplierName: "", supplierContactNumber: "", supplierCompany: "" }));
      return;
    }
    const supplier = suppliers.find((item) => item.id === id);
    if (supplier) setDraft((current) => ({ ...current, supplierId: supplier.id, supplierName: supplier.name, supplierContactNumber: supplier.contactNumber, supplierCompany: supplier.company }));
  };
  const submit = () => {
    const values: ExchangeFormValues = {
      ...draft,
      givenQuantity: Number(draft.givenQuantity),
      tradeInUnitValue: Number(draft.tradeInUnitValue),
      receivedQuantity: Number(draft.receivedQuantity),
      receivedUnitSellingPrice: Number(draft.receivedUnitSellingPrice),
      supplierUnitCost: Number(draft.supplierUnitCost),
      supplierPaidAmount: Number(draft.supplierPaidAmount),
    };
    const result = addExchange(values);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onClose();
  };

  return <Modal open={open} title={isBuyback ? "Buy phone from customer" : "Record exchange"} description={isBuyback ? "Record a customer phone purchase and add the device to inventory." : "Take in the customer's phone and sell the replacement phone in one linked transaction."} onClose={onClose} wide>
    <div className="exchange-form-modal">
      {!products.length ? <p className="exchange-form-empty">Add the products to your catalog first, then record an exchange.</p> : <>
        <section className="exchange-form-section">
          <SelectField label="Transaction type" value={draft.mode} onChange={(event) => update("mode", event.target.value as ExchangeDraft["mode"])}><option value="exchange">Exchange: customer gives one phone and receives another</option><option value="buyback">Buyback: customer sells a phone to us</option></SelectField>
          <h3>Customer</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3"><SelectField label="Customer" searchable value={draft.customerId || "__new_customer__"} onChange={(event) => selectCustomer(event.target.value)}><option value="__new_customer__">+ Add new customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</SelectField></div>
            <Field label="Customer name" value={draft.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="e.g. Ahmed Khan" />
            <Field label="Contact number" value={draft.customerContactNumber} onChange={(event) => update("customerContactNumber", event.target.value)} placeholder="e.g. 0300 1234567" />
            <Field label="Customer code" value={draft.customerCode} readOnly />
          </div>
        </section>
        <div className="exchange-form-columns">
          <section className="exchange-form-section exchange-side-card">
            <h3>{isBuyback ? "Phone purchased from customer" : "Customer gives"}</h3>
            <SelectField label="Phone received" searchable searchPlaceholder="Search trade-in phone..." value={draft.givenProductId} onChange={(event) => selectGivenProduct(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.color || "Unspecified"}</option>)}</SelectField>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Quantity" type="number" min={1} value={draft.givenQuantity} onChange={(event) => update("givenQuantity", event.target.value)} /><Field label="Trade-in value / phone" type="number" min={1} value={draft.tradeInUnitValue} onChange={(event) => update("tradeInUnitValue", event.target.value)} /></div>
            <p className="exchange-form-help">This phone is added to inventory at its {isBuyback ? "purchase" : "trade-in"} value.</p>
          </section>
          {!isBuyback && <section className="exchange-form-section exchange-side-card">
            <h3>Customer receives</h3>
            <SelectField label="Replacement phone" searchable searchPlaceholder="Search replacement phone..." value={draft.receivedProductId} onChange={(event) => selectReceivedProduct(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.color || "Unspecified"} · {product.inStockQuantity} in stock</option>)}</SelectField>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Quantity" type="number" min={1} value={draft.receivedQuantity} onChange={(event) => update("receivedQuantity", event.target.value)} /><Field label="Selling price / phone" type="number" min={1} value={draft.receivedUnitSellingPrice} onChange={(event) => update("receivedUnitSellingPrice", event.target.value)} /></div>
            <SelectField label="Replacement source" value={draft.receiveSource} onChange={(event) => update("receiveSource", event.target.value as ExchangeDraft["receiveSource"])}><option value="inventory">Use available inventory</option><option value="supplier">Arrange from supplier</option></SelectField>
          </section>}
        </div>
        {!isBuyback && draft.receiveSource === "supplier" && <section className="exchange-form-section">
          <h3>Supplier arrangement</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3"><SelectField label="Existing supplier" value={draft.supplierId || ""} onChange={(event) => selectSupplier(event.target.value)}><option value="">+ New supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.company ? ` · ${supplier.company}` : ""}</option>)}</SelectField></div>
            <Field label="Supplier name" value={draft.supplierName} onChange={(event) => update("supplierName", event.target.value)} placeholder="e.g. Tech Source" />
            <Field label="Supplier contact" value={draft.supplierContactNumber} onChange={(event) => update("supplierContactNumber", event.target.value)} placeholder="e.g. 0300 1234567" />
            <Field label="Company (optional)" value={draft.supplierCompany ?? ""} onChange={(event) => update("supplierCompany", event.target.value)} placeholder="e.g. Wholesale division" />
            <Field label="Supplier cost / phone" type="number" min={1} value={draft.supplierUnitCost} onChange={(event) => update("supplierUnitCost", event.target.value)} />
            <Field label="Paid to supplier" type="number" min={0} value={draft.supplierPaidAmount} onChange={(event) => update("supplierPaidAmount", event.target.value)} />
          </div>
        </section>}
        <div className="exchange-calculation-card">{isBuyback ? <><div><span>Customer payout</span><strong>{formatCurrency(tradeInTotal)}</strong></div><span>→ inventory</span></> : <><div><span>Replacement total</span><strong>{formatCurrency(saleTotal)}</strong></div><ArrowLeftRight size={17} /><div><span>Trade-in credit</span><strong>{formatCurrency(tradeInTotal)}</strong></div><b>=</b><div><span>{amountDue >= 0 ? "Amount customer pays" : "Customer credit"}</span><strong className={amountDue >= 0 ? "value-positive" : "value-negative"}>{formatCurrency(Math.abs(amountDue))}</strong></div></>}</div>
        {error && <p className="exchange-form-error">{error}</p>}
        <div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" className="cancel-button" onClick={onClose}>Cancel</Button><Button type="button" variant="brand" onClick={submit}>{isBuyback ? "Record buyback" : "Record exchange"}</Button></div>
      </>}
    </div>
  </Modal>;
}
