"use client";

import { Building2, CircleDollarSign, Crown, Filter, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Button } from "../../../components/primitives/button";
import { ConfirmDialog, Field, Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatTransactionTime, getCapitalSummary, type Supplier, type SupplierPayment, type Transaction } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type SupplierRow = Supplier & { purchaseCount: number; totalPurchased: number; totalPaid: number; outstanding: number };
type SupplierDraft = { name: string; contactNumber: string; company: string; cnicNumber: string; openingBalance: string };
type SupplierFieldErrors = Partial<Record<keyof SupplierDraft, string>>;

const activityOptions = ["All suppliers", "Active suppliers", "No purchases yet"];
const balanceOptions = ["All balances", "Outstanding balances", "Paid in full"];

export default function SuppliersPage() {
  const { suppliers, transactions, supplierPayments, capitalAccounts, capitalEntries, expenses, addSupplier, updateSupplier, deleteSupplier, addSupplierPayment } = useErpStore();
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>({ name: "", contactNumber: "", company: "", cnicNumber: "", openingBalance: "" });
  const [fieldErrors, setFieldErrors] = useState<SupplierFieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<SupplierRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentCapitalId, setPaymentCapitalId] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState(activityOptions[0]);
  const [balance, setBalance] = useState(balanceOptions[0]);
  const [draftActivity, setDraftActivity] = useState(activityOptions[0]);
  const [draftBalance, setDraftBalance] = useState(balanceOptions[0]);
  const [filterOpen, setFilterOpen] = useState(false);

  const rows = useMemo<SupplierRow[]>(() => suppliers.map((supplier) => {
    const purchases = supplierPurchases(supplier, transactions);
    const totalPurchased = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const totalPaid = supplierPayments.filter((payment) => payment.supplierId === supplier.id).reduce((sum, payment) => sum + payment.amount, 0);
    return { ...supplier, purchaseCount: purchases.length, totalPurchased, totalPaid, outstanding: Math.max(totalPurchased - totalPaid + (supplier.openingBalance ?? 0), 0) };
  }), [suppliers, transactions, supplierPayments]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesActivity = activity === activityOptions[0]
        || (activity === "Active suppliers" && row.purchaseCount > 0)
        || (activity === "No purchases yet" && row.purchaseCount === 0);
      const matchesBalance = balance === balanceOptions[0]
        || (balance === "Outstanding balances" && row.outstanding > 0)
        || (balance === "Paid in full" && row.outstanding === 0);
      const matchesSearch = !query || [row.name, row.company, row.contactNumber, row.cnicNumber ?? ""].some((value) => value.toLowerCase().includes(query));
      return matchesActivity && matchesBalance && matchesSearch;
    });
  }, [activity, balance, rows, search]);

  const activeSuppliers = rows.filter((row) => row.purchaseCount > 0).length;
  const topPurchaseSource = useMemo(() => rows.filter((row) => row.totalPurchased > 0).sort((a, b) => b.totalPurchased - a.totalPurchased)[0] ?? null, [rows]);
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);

  const openCreate = () => {
    setEditing(null);
    setDraft({ name: "", contactNumber: "", company: "", cnicNumber: "", openingBalance: "" });
    setFieldErrors({});
    setEditorOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setDraft({ name: supplier.name, contactNumber: supplier.contactNumber, company: supplier.company, cnicNumber: formatCnic(supplier.cnicNumber ?? ""), openingBalance: supplier.openingBalance ? String(supplier.openingBalance) : "" });
    setFieldErrors({});
    setEditorOpen(true);
  };

  const openFilters = () => {
    setDraftActivity(activity);
    setDraftBalance(balance);
    setFilterOpen(true);
  };

  const submitFilters = () => {
    setActivity(draftActivity);
    setBalance(draftBalance);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setActivity(activityOptions[0]);
    setBalance(balanceOptions[0]);
  };

  const openPayment = (supplier: SupplierRow) => {
    setPaymentTarget(supplier);
    setPaymentAmount(supplier.outstanding > 0 ? String(supplier.outstanding) : "");
    setPaymentNote("");
    setPaymentCapitalId("");
    setPaymentError(null);
  };

  const closePayment = () => {
    setPaymentTarget(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentCapitalId("");
    setPaymentError(null);
  };

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }
    if (amount > paymentTarget.outstanding) {
      setPaymentError("Payment cannot exceed the supplier's outstanding balance.");
      return;
    }
    const result = addSupplierPayment({ supplierId: paymentTarget.id, amount, note: paymentNote, capitalId: paymentCapitalId || undefined });
    if (!result.ok) {
      setPaymentError(result.message);
      return;
    }
    closePayment();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: SupplierFieldErrors = {};
    if (!draft.name.trim()) nextErrors.name = "Supplier name is required.";
    if (!draft.contactNumber.trim()) nextErrors.contactNumber = "Contact number is required.";
    if (draft.cnicNumber && draft.cnicNumber.replace(/\D/g, "").length !== 13) nextErrors.cnicNumber = "Enter a valid CNIC in the format 35202-1234567-1.";
    if (draft.openingBalance && (!Number.isFinite(Number(draft.openingBalance)) || Number(draft.openingBalance) < 0)) nextErrors.openingBalance = "Enter zero or a positive amount.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    const supplierValues = { ...draft, openingBalance: draft.openingBalance ? Number(draft.openingBalance) : 0 };
    const result = editing ? updateSupplier(editing.id, supplierValues) : addSupplier(supplierValues);
    if (!result.ok) {
      setFieldErrors({ contactNumber: result.message });
      return;
    }
    setEditorOpen(false);
    setFieldErrors({});
  };

  return (
    <div className="erp-content">
      <div className="erp-page-heading">
        <div><h1 className="erp-page-title">Suppliers</h1></div>
        <div className="flex gap-2">
          <Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={openFilters}><Filter size={14} />Filters</Button>
          <Button variant="brand" className="inventory-add-product-button font-sans text-sm font-medium text-white min-h-10 px-4 rounded-[15px] gap-2" onClick={openCreate}><Plus size={14} />Add supplier</Button>
        </div>
      </div>

      <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]">
        <KpiCard label="Total suppliers" value={String(rows.length)} note="Supplier accounts" icon={<Users size={16} />} />
        <KpiCard label="Active suppliers" value={String(activeSuppliers)} note="Suppliers with purchases" icon={<Building2 size={16} />} tone="success" />
        <KpiCard label="Top purchase source" value={topPurchaseSource?.company || topPurchaseSource?.name || "No purchases yet"} note={topPurchaseSource ? `${formatCurrency(topPurchaseSource.totalPurchased)} purchased` : "No purchases recorded"} icon={<Crown size={16} />} tone="success" />
        <KpiCard label="Outstanding balance" value={formatCurrency(totalOutstanding)} note="You need to pay" icon={<CircleDollarSign size={16} />} tone={totalOutstanding > 0 ? "error" : "success"} />
      </div>

      {(activity !== activityOptions[0] || balance !== balanceOptions[0]) && (
        <div className="solexa-filter-chips">
          {activity !== activityOptions[0] && <FilterChip label={activity} onClear={() => setActivity(activityOptions[0])} />}
          {balance !== balanceOptions[0] && <FilterChip label={balance} onClear={() => setBalance(balanceOptions[0])} />}
          <button type="button" className="solexa-filter-clear" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      <label className="inventory-search-bar">
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, company, or contact..." aria-label="Search supplier, company, or contact" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
      </label>

      <section className="erp-card">
        <div className="erp-card-header">
          <div><h2 className="erp-card-title">Supplier directory</h2><p className="erp-card-subtitle">Supplier records remain separate from customer accounts.</p></div>
          <Building2 size={19} className="text-[var(--primary)]" />
        </div>
        <DataTable
          className="inventory-table supplier-table"
          data={visibleRows}
          searchable={false}
          paginationOnly
          keyExtractor={(row) => row.id}
          emptyText="No suppliers match these filters."
          columns={[
            { key: "name", header: "Supplier", width: "24%", sortable: true, accessor: (row) => <div><p className="font-semibold text-[var(--text-primary)]">{row.name}</p><p className="text-[var(--text-muted)]">{row.company || "No company"}</p></div> },
            { key: "company", header: "Company", width: "18%", sortable: true, accessor: (row) => row.company || "—" },
            { key: "cnicNumber", header: "CNIC number", width: "16%", sortable: true, accessor: (row) => row.cnicNumber ? formatCnic(row.cnicNumber) : "—" },
            { key: "totalPurchased", header: "Purchased", width: "14%", align: "right", sortable: true, accessor: (row) => formatCurrency(row.totalPurchased) },
            { key: "outstanding", header: "Outstanding", width: "12%", align: "right", sortable: true, accessor: (row) => <span className={row.outstanding > 0 ? "font-bold value-negative" : "font-bold value-positive"}>{formatCurrency(row.outstanding)}</span> },
            { key: "actions", header: "Actions", width: "16%", align: "right", accessor: (row) => <div className="table-row-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="table-icon-button" aria-label={`Edit ${row.name}`} title="Edit supplier" onClick={() => openEdit(row)}><Pencil size={14} /></button><button type="button" className="table-icon-button disabled:opacity-40 disabled:cursor-not-allowed" aria-label={`Record payment for ${row.name}`} title={row.outstanding > 0 ? "Record payment" : "No outstanding balance"} disabled={row.outstanding <= 0} onClick={() => openPayment(row)}><CircleDollarSign size={14} /></button><button type="button" className="table-icon-danger" aria-label={`Delete ${row.name}`} title="Delete supplier" onClick={() => setDeleteTarget(row)}><Trash2 size={14} /></button></div> },
          ]}
        />
      </section>

      <Modal open={filterOpen} title="Filter suppliers" description="Choose the supplier records you want to see." onClose={() => setFilterOpen(false)}>
        <div className="filter-inline-row p-5">
          <SelectField label="Supplier activity" value={draftActivity} onChange={(event) => setDraftActivity(event.target.value)}>{activityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>
          <SelectField label="Balance status" value={draftBalance} onChange={(event) => setDraftBalance(event.target.value)}>{balanceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>
          <div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button inventory-add-product-button !text-white" onClick={submitFilters}>Apply filters</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.name} description={selected ? `${selected.company || "No company"} · ${selected.contactNumber || "No contact number"}` : undefined} onClose={() => setSelected(null)}>{selected && <SupplierDetail supplier={selected} transactions={transactions} payments={supplierPayments} />}</Modal>

      <Modal open={Boolean(paymentTarget)} title="Record supplier payment" description={paymentTarget ? `Record a payment for ${paymentTarget.name}.` : undefined} onClose={closePayment}>
        <form onSubmit={submitPayment} className="supplier-payment-form grid gap-4 p-5">
          {paymentTarget && <div className="supplier-payment-summary"><div className="supplier-payment-summary-card"><span className="supplier-payment-summary-label">Supplier</span><strong className="supplier-payment-summary-value">{paymentTarget.name}</strong><span className="supplier-payment-summary-detail">{paymentTarget.company || "No company"}</span></div><div className="supplier-payment-summary-card"><span className="supplier-payment-summary-label">Outstanding balance</span><strong className="supplier-payment-summary-value value-negative">{formatCurrency(paymentTarget.outstanding)}</strong></div></div>}
          <Field label="Payment amount" type="text" inputMode="decimal" value={formatAmountInput(paymentAmount)} hint={paymentError ?? undefined} onChange={(event) => { const raw = event.target.value.replace(/[^\d.]/g, ""); const [whole, fraction] = raw.split("."); setPaymentAmount(fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`); setPaymentError(null); }} placeholder="e.g. 25,000" />
          <Field label="Payment note (optional)" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="e.g. Paid by bank transfer" />
          <SelectField label="Funding source" value={paymentCapitalId ? `capital:${paymentCapitalId}` : "other"} onChange={(event) => setPaymentCapitalId(event.target.value.startsWith("capital:") ? event.target.value.slice(8) : "")}>
            <option value="other">Other funds</option>
            {capitalAccounts.map((account) => { const available = getCapitalSummary(account.id, capitalEntries, transactions, supplierPayments, expenses).available; return <option key={account.id} value={`capital:${account.id}`}>{account.name} · {formatCurrency(available)} available</option>; })}
          </SelectField>
          <div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" className="cancel-button !bg-[var(--error)] !text-white" onClick={closePayment}>Cancel</Button><Button type="submit" variant="brand" className="inventory-add-product-button !text-white">Record payment</Button></div>
        </form>
      </Modal>

      <Modal open={editorOpen} title={editing ? "Edit supplier" : "Add supplier"} description="Supplier contact numbers must be unique." onClose={() => setEditorOpen(false)}>
        <form onSubmit={submit} className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <Field label="Supplier name" value={draft.name} hint={fieldErrors.name} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: undefined })); }} placeholder="e.g. Tech Source Ltd." />
            <Field label="Contact number" value={draft.contactNumber} hint={fieldErrors.contactNumber} onChange={(event) => { setDraft((current) => ({ ...current, contactNumber: event.target.value })); setFieldErrors((current) => ({ ...current, contactNumber: undefined })); }} placeholder="e.g. 0300 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <Field label="Company (optional)" hint={fieldErrors.company} value={draft.company} onChange={(event) => { setDraft((current) => ({ ...current, company: event.target.value })); setFieldErrors((current) => ({ ...current, company: undefined })); }} placeholder="e.g. Wholesale division" />
            <Field label="CNIC number (optional)" hint={fieldErrors.cnicNumber} value={draft.cnicNumber} onChange={(event) => { setDraft((current) => ({ ...current, cnicNumber: formatCnic(event.target.value) })); setFieldErrors((current) => ({ ...current, cnicNumber: undefined })); }} placeholder="e.g. 35202-1234567-1" inputMode="numeric" maxLength={15} numberOnly />
          </div>
          <Field label="Outstanding balance (optional)" hint={fieldErrors.openingBalance} type="number" min={0} step="0.01" value={draft.openingBalance} onChange={(event) => { setDraft((current) => ({ ...current, openingBalance: event.target.value })); setFieldErrors((current) => ({ ...current, openingBalance: undefined })); }} placeholder="e.g. 25000" />
          <div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" className="cancel-button !bg-[var(--error)] !text-white" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" variant="brand" className="inventory-add-product-button !text-white">{editing ? "Save changes" : "Add supplier"}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete supplier?" description={deleteTarget ? `${deleteTarget.name} will be removed from the supplier directory.` : undefined} confirmLabel="Delete supplier" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteSupplier(deleteTarget.id); setDeleteTarget(null); setSelected(null); }} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return <span className="solexa-filter-chip">{label}<button type="button" onClick={onClear} aria-label={`Remove ${label} filter`}><X size={12} /></button></span>;
}

function supplierPurchases(supplier: Supplier, transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.type === "purchase" && (transaction.supplierId === supplier.id || transaction.party === supplier.name)).map((transaction) => ({ ...transaction, time: formatTransactionTime(transaction) }));
}

function SupplierDetail({ supplier, transactions, payments }: { supplier: SupplierRow; transactions: Transaction[]; payments: SupplierPayment[] }) {
  const purchases = supplierPurchases(supplier, transactions);
  const supplierPayments = payments.filter((payment) => payment.supplierId === supplier.id);
  return <div className="supplier-detail-content p-5"><div className="supplier-detail-summary"><Info label="Company" value={supplier.company || "Not set"} /><Info label="Contact number" value={supplier.contactNumber || "Not set"} /><Info label="CNIC number" value={supplier.cnicNumber ? formatCnic(supplier.cnicNumber) : "Not set"} /><Info label="Purchased" value={formatCurrency(supplier.totalPurchased)} /><Info label="Outstanding" value={formatCurrency(supplier.outstanding)} tone={supplier.outstanding > 0 ? "negative" : "positive"} /></div><div className="mt-5"><h3 className="text-sm font-black text-[var(--text-primary)]">Purchase history</h3>{purchases.length ? <div className="mt-3 grid gap-2">{purchases.map((purchase) => <div key={purchase.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><div><p className="text-xs font-bold text-[var(--text-primary)]">{purchase.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{purchase.time} · {purchase.quantity} units</p></div><strong className="text-xs value-negative">{formatCurrency(purchase.amount)}</strong></div>)}</div> : <p className="mt-3 text-xs text-[var(--text-muted)]">No purchases recorded for this supplier.</p>}</div>{supplierPayments.length > 0 && <div className="mt-5"><h3 className="text-sm font-black text-[var(--text-primary)]">Payments</h3><div className="mt-3 grid gap-2">{supplierPayments.map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs text-[var(--text-muted)]">{payment.time}{payment.note ? ` · ${payment.note}` : ""}</span><strong className="text-xs value-positive">{formatCurrency(payment.amount)}</strong></div>)}</div></div>}</div>;
}

function Info({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  return <div className="supplier-detail-info-card"><span className="supplier-detail-info-label">{label}</span><strong className={`supplier-detail-info-value ${tone === "positive" ? "value-positive" : tone === "negative" ? "value-negative" : ""}`}>{value}</strong></div>;
}

function formatCnic(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function formatAmountInput(value: string) {
  if (!value) return "";
  const [whole, fraction] = value.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? formattedWhole : `${formattedWhole}.${fraction}`;
}
