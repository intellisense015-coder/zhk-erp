"use client";

import { ArrowRightLeft, Boxes, ClipboardList, Plus, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Button } from "../../../components/primitives/button";
import { Field, Modal, SelectField } from "../../../components/primitives/primitives";
import { Notification, type NotificationVariant } from "../../../components/primitives/notification";
import { DataTable, TableBadge } from "../../../components/primitives/table";
import { formatCompactCurrency, formatCurrency, formatLongDate } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type TransferKind = "supplier-to-customer" | "customer-to-customer";
type EntitySide = "from" | "to";

const ADD_FROM = "__add_from__";
const ADD_TO = "__add_to__";

export default function TransfersPage() {
  const { products, transactions, customers, suppliers, addTransfer, addCustomer, addSupplier } = useErpStore();
  const [transferKind, setTransferKind] = useState<TransferKind>("supplier-to-customer");
  const [fromEntity, setFromEntity] = useState("");
  const [toEntity, setToEntity] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("0");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [entitySide, setEntitySide] = useState<EntitySide | null>(null);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityContact, setNewEntityContact] = useState("");
  const [newEntityCompany, setNewEntityCompany] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);
  const [notification, setNotification] = useState<{ message: string; variant: NotificationVariant } | null>(null);

  const effectiveProductId = productId || products[0]?.id || "";
  const selectedProduct = products.find((product) => product.id === effectiveProductId);
  const transfers = useMemo(() => transactions.filter((transaction) => transaction.type === "transfer"), [transactions]);
  const visibleTransfers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transfers.filter((transaction) => !query || `${transaction.name} ${transaction.fromEntity ?? ""} ${transaction.toEntity ?? ""} ${transaction.transferKind ?? ""}`.toLowerCase().includes(query));
  }, [search, transfers]);
  const totalValue = transfers.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalUnits = transfers.reduce((sum, transaction) => sum + transaction.quantity, 0);
  const fromOptions = transferKind === "supplier-to-customer" ? suppliers : customers;
  const toOptions = customers;
  const entityType = entitySide && entitySide === "from" && transferKind === "supplier-to-customer" ? "supplier" : "customer";

  const chooseEntity = (side: EntitySide, value: string) => {
    if (value === ADD_FROM || value === ADD_TO) {
      setEntitySide(side);
      setNewEntityName("");
      setNewEntityContact("");
      setNewEntityCompany("");
      return;
    }
    if (side === "from") setFromEntity(value);
    else setToEntity(value);
  };

  const submitNewEntity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entitySide) return;
    setAddingEntity(true);
    const result = entityType === "supplier"
      ? await addSupplier({ name: newEntityName, contactNumber: newEntityContact, company: newEntityCompany })
      : await addCustomer({ name: newEntityName, contactNumber: newEntityContact });
    setAddingEntity(false);
    if (!result.ok) {
      setNotification({ variant: "error", message: result.message });
      return;
    }
    const createdName = newEntityName.trim();
    if (entitySide === "from") setFromEntity(createdName);
    else setToEntity(createdName);
    setEntitySide(null);
    setNotification({ variant: "success", message: `${entityType === "supplier" ? "Supplier" : "Customer"} added and selected.` });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotification(null);
    setSaving(true);
    const result = await addTransfer({ transferKind, fromEntity, toEntity, productId: effectiveProductId, quantity: Number(quantity), amount: Number(amount) });
    setSaving(false);
    if (!result.ok) {
      setNotification({ variant: "error", message: result.message });
      return;
    }
    setFromEntity("");
    setToEntity("");
    setQuantity("1");
    setAmount("0");
    setNotification({ variant: "success", message: "Transfer recorded securely." });
  };

  const changeTransferKind = (nextKind: TransferKind) => {
    setTransferKind(nextKind);
    setFromEntity("");
    setToEntity("");
  };

  return <div className="erp-content inventory-page-enter transfers-page">
    <div className="erp-page-heading"><div><p className="erp-eyebrow">Operations</p><h1 className="erp-page-title">Transfers</h1><p className="erp-page-subtitle">Record product movement between named business entities.</p></div></div>
    <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]"><KpiCard label="Transfer records" value={String(transfers.length)} note="Recorded movements" icon={<ClipboardList size={16} />} /><KpiCard label="Units transferred" value={String(totalUnits)} note="Across all records" icon={<Boxes size={16} />} tone="success" /><KpiCard label="Transfer value" value={formatCompactCurrency(totalValue)} note="Recorded movement value" icon={<ArrowRightLeft size={16} />} /></div>
    <section className="erp-card transfer-editor-card mb-[18px]"><div className="erp-card-header"><div><h2 className="erp-card-title">Record a transfer</h2><p className="erp-card-subtitle">This creates an audited Supabase transaction. Total stock remains unchanged.</p></div><ArrowRightLeft size={19} className="text-[var(--primary)]" /></div><form onSubmit={submit} className="transfer-form"><div className="transfer-form-grid"><SelectField label="Transfer type" value={transferKind} onChange={(event) => changeTransferKind(event.target.value as TransferKind)}><option value="supplier-to-customer">Supplier to customer</option><option value="customer-to-customer">Customer to customer</option></SelectField><SelectField label="From entity" value={fromEntity} searchable searchPlaceholder="Search suppliers..." onChange={(event) => chooseEntity("from", event.target.value)}><option value="">Select {transferKind === "supplier-to-customer" ? "supplier" : "customer"}</option>{fromOptions.map((entity) => <option key={entity.id} value={entity.name}>{entity.name}</option>)}<option value={ADD_FROM}><Plus size={12} /> Add new {transferKind === "supplier-to-customer" ? "supplier" : "customer"}</option></SelectField><SelectField label="To entity" value={toEntity} searchable searchPlaceholder="Search customers..." onChange={(event) => chooseEntity("to", event.target.value)}><option value="">Select customer</option>{toOptions.map((entity) => <option key={entity.id} value={entity.name}>{entity.name}</option>)}<option value={ADD_TO}><Plus size={12} /> Add new customer</option></SelectField></div><div className="transfer-form-grid transfer-form-grid-details"><SelectField label="Product" value={effectiveProductId} searchable searchPlaceholder="Search products..." onChange={(event) => setProductId(event.target.value)} disabled={products.length === 0}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.inStockQuantity} available</option>)}</SelectField><Field label="Quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /><Field label="Transfer value" type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="transfer-form-summary"><span>Available stock</span><strong>{selectedProduct ? `${selectedProduct.inStockQuantity} ${selectedProduct.inStockQuantity === 1 ? "unit" : "units"}` : "Select a product"}</strong></div><div className="primitive-dialog-actions transfer-form-actions"><Button type="submit" variant="brand" disabled={saving || products.length === 0}>{saving ? "Recording..." : "Record transfer"}</Button></div></form></section>
    <section className="erp-card transfer-history-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Transfer history</h2><p className="erp-card-subtitle">{visibleTransfers.length} records in the current workspace.</p></div><ClipboardList size={19} className="text-[var(--primary)]" /></div><div className="transfer-history-toolbar"><label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transfer history..." aria-label="Search transfer history" /></label></div><DataTable className="inventory-table transfer-history-table" data={visibleTransfers} searchable={false} paginationOnly keyExtractor={(transaction) => transaction.id} emptyText="No transfers recorded yet." columns={[{ key: "type", header: "Type", sortable: true, accessor: () => <TableBadge tone="brand"><ArrowRightLeft size={12} />Transfer</TableBadge> }, { key: "name", header: "Product", sortable: true, accessor: (transaction) => <span className="font-semibold text-[var(--text-primary)]">{transaction.name}</span> }, { key: "entities", header: "From / To", sortable: true, accessor: (transaction) => <div className="transfer-entity-cell"><span>{transaction.fromEntity}</span><small>→ {transaction.toEntity}</small></div> }, { key: "quantity", header: "Qty", sortable: true, align: "right" }, { key: "amount", header: "Value", sortable: true, align: "right", accessor: (transaction) => <span className="font-bold text-[var(--primary)]">{formatCurrency(transaction.amount)}</span> }, { key: "date", header: "Recorded", sortable: true, align: "right", accessor: (transaction) => formatLongDate(transaction.date) }]} /></section>
    <Modal open={Boolean(entitySide)} title={`Add ${entityType}`} description={`Create a ${entityType} and use it for this transfer.`} onClose={() => setEntitySide(null)}><form onSubmit={submitNewEntity} className="grid gap-4 p-5"><Field label={`${entityType === "supplier" ? "Supplier" : "Customer"} name`} value={newEntityName} onChange={(event) => setNewEntityName(event.target.value)} placeholder={`Enter ${entityType} name`} maxLength={200} autoFocus /><Field label="Contact number" value={newEntityContact} onChange={(event) => setNewEntityContact(event.target.value)} placeholder="03xx xxxxxxx" maxLength={30} />{entityType === "supplier" && <Field label="Company (optional)" value={newEntityCompany} onChange={(event) => setNewEntityCompany(event.target.value)} placeholder="Company name" maxLength={200} />}<div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" onClick={() => setEntitySide(null)}>Cancel</Button><Button type="submit" variant="brand" disabled={addingEntity}>{addingEntity ? "Adding..." : `Add ${entityType}`}</Button></div></form></Modal>
    <Notification message={notification?.message} variant={notification?.variant ?? "success"} onDismiss={() => setNotification(null)} />
  </div>;
}
