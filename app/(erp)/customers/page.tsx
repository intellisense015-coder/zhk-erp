"use client";

import { Crown, Eye, Filter, Pencil, Plus, Search, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Button } from "../../../components/primitives/button";
import { ConfirmDialog, Field, Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatTransactionTime, type Customer, type Transaction } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type CustomerRow = Customer & { salesCount: number; totalSpent: number; lastActivity: string };
type CustomerDraft = { name: string; contactNumber: string; gender: string; cnicNumber: string };
type CustomerFieldErrors = Partial<Record<keyof CustomerDraft, string>>;

const activityOptions = ["All customers", "Active customers", "No sales yet"];
const purchaseOptions = ["All purchase history", "With purchases", "Without purchases"];

export default function CustomersPage() {
  const { customers, transactions, addCustomer, updateCustomer, deleteCustomer } = useErpStore();
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<CustomerDraft>({ name: "", contactNumber: "", gender: "", cnicNumber: "" });
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState(activityOptions[0]);
  const [purchaseHistory, setPurchaseHistory] = useState(purchaseOptions[0]);
  const [registrationMonth, setRegistrationMonth] = useState("All months");
  const [draftActivity, setDraftActivity] = useState(activityOptions[0]);
  const [draftPurchaseHistory, setDraftPurchaseHistory] = useState(purchaseOptions[0]);
  const [draftRegistrationMonth, setDraftRegistrationMonth] = useState("All months");
  const [filterOpen, setFilterOpen] = useState(false);

  const [currentMonth, setCurrentMonth] = useState("");

  useEffect(() => {
    setCurrentMonth(getMonthKey(new Date()));
  }, []);

  const previousMonth = currentMonth ? getPreviousMonth(currentMonth) : "";

  const rows = useMemo<CustomerRow[]>(() => customers.map((customer) => {
    const sales = customerSales(customer, transactions);
    return {
      ...customer,
      salesCount: sales.length,
      totalSpent: sales.reduce((sum, sale) => sum + sale.amount, 0),
      lastActivity: sales[0]?.time ?? "No sales yet",
    };
  }), [customers, transactions]);

  const monthOptions = useMemo(() => {
    if (!currentMonth) return [];

    const year = currentMonth.slice(0, 4);
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).reverse();
  }, [currentMonth]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesActivity = activity === "All customers"
        || (activity === "Active customers" && row.salesCount > 0)
        || (activity === "No sales yet" && row.salesCount === 0);
      const matchesPurchaseHistory = purchaseHistory === "All purchase history"
        || (purchaseHistory === "With purchases" && row.totalSpent > 0)
        || (purchaseHistory === "Without purchases" && row.totalSpent === 0);
      const matchesRegistrationMonth = registrationMonth === "All months" || row.createdAt.slice(0, 7) === registrationMonth;
      const matchesSearch = !query || [row.name, row.contactNumber, row.gender ?? "", row.cnicNumber ?? "", row.lastActivity]
        .some((value) => value.toLowerCase().includes(query));
      return matchesActivity && matchesPurchaseHistory && matchesRegistrationMonth && matchesSearch;
    });
  }, [activity, purchaseHistory, registrationMonth, rows, search]);

  const activeCustomers = rows.filter((row) => row.salesCount > 0).length;
  const biggestCustomer = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number }>();
    transactions.forEach((transaction) => {
      if (transaction.type !== "sale" || transaction.month !== currentMonth) return;
      const customer = customers.find((item) => item.id === transaction.customerId || item.name === transaction.party);
      if (!customer) return;
      const current = totals.get(customer.id) ?? { name: customer.name, amount: 0 };
      totals.set(customer.id, { name: customer.name, amount: current.amount + transaction.amount });
    });
    return [...totals.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
  }, [customers, currentMonth, transactions]);
  const newCustomersThisMonth = rows.filter((row) => row.createdAt.slice(0, 7) === currentMonth).length;
  const newCustomersPreviousMonth = rows.filter((row) => row.createdAt.slice(0, 7) === previousMonth).length;
  const newCustomersTrend = newCustomersPreviousMonth === 0
    ? (newCustomersThisMonth > 0 ? 100 : 0)
    : Math.round(((newCustomersThisMonth - newCustomersPreviousMonth) / newCustomersPreviousMonth) * 100);
  const newCustomersTone = newCustomersThisMonth > newCustomersPreviousMonth ? "success" : newCustomersThisMonth < newCustomersPreviousMonth ? "error" : "default";

  const openCreate = () => {
    setEditing(null);
    setDraft({ name: "", contactNumber: "", gender: "", cnicNumber: "" });
    setFieldErrors({});
    setEditorOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setDraft({ name: customer.name, contactNumber: customer.contactNumber, gender: customer.gender ?? "", cnicNumber: formatCnic(customer.cnicNumber ?? "") });
    setFieldErrors({});
    setEditorOpen(true);
  };

  const openFilters = () => {
    setDraftActivity(activity);
    setDraftPurchaseHistory(purchaseHistory);
    setDraftRegistrationMonth(registrationMonth);
    setFilterOpen(true);
  };

  const submitFilters = () => {
    setActivity(draftActivity);
    setPurchaseHistory(draftPurchaseHistory);
    setRegistrationMonth(draftRegistrationMonth);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setActivity(activityOptions[0]);
    setPurchaseHistory(purchaseOptions[0]);
    setRegistrationMonth("All months");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: CustomerFieldErrors = {};
    if (!draft.name.trim()) nextErrors.name = "Customer name is required.";
    if (!draft.contactNumber.trim()) nextErrors.contactNumber = "Contact number is required.";
    if (!draft.gender) nextErrors.gender = "Gender is required.";
    if (draft.cnicNumber && draft.cnicNumber.replace(/\D/g, "").length !== 13) nextErrors.cnicNumber = "Enter a valid CNIC in the format 35202-1234567-1.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    const result = editing ? updateCustomer(editing.id, draft) : addCustomer(draft);
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
        <div><h1 className="erp-page-title">Customers</h1></div>
        <div className="flex gap-2">
          <Button variant="secondary" className="font-sans text-sm font-medium text-[var(--text)] min-h-10 px-4 rounded-[15px] gap-2" onClick={openFilters}><Filter size={14} />Filters</Button>
          <Button variant="brand" className="inventory-add-product-button font-sans text-sm font-medium text-white min-h-10 px-4 rounded-[15px] gap-2" onClick={openCreate}><Plus size={14} />Add customer</Button>
        </div>
      </div>

      <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]">
        <KpiCard label="Total customers" value={String(rows.length)} note="Customer accounts" icon={<Users size={16} />} />
        <KpiCard label="Active customers" value={String(activeCustomers)} note="Customers with sales" icon={<UserCheck size={16} />} tone="success" />
        <KpiCard label="Biggest customer this month" value={biggestCustomer?.name ?? "No sales yet"} note={biggestCustomer ? `${formatCurrency(biggestCustomer.amount)} spent` : "No customer sales this month"} icon={<Crown size={16} />} tone="success" />
        <KpiCard label="New this month" value={String(newCustomersThisMonth)} note="Compared with previous month" icon={<UserPlus size={16} />} tone={newCustomersTone} trend={newCustomersTrend} />
      </div>

      {(activity !== activityOptions[0] || purchaseHistory !== purchaseOptions[0] || registrationMonth !== "All months") && (
        <div className="solexa-filter-chips">
          {activity !== activityOptions[0] && <FilterChip label={activity} onClear={() => setActivity(activityOptions[0])} />}
          {purchaseHistory !== purchaseOptions[0] && <FilterChip label={purchaseHistory} onClear={() => setPurchaseHistory(purchaseOptions[0])} />}
          {registrationMonth !== "All months" && <FilterChip label={monthOptionLabel(registrationMonth)} onClear={() => setRegistrationMonth("All months")} />}
          <button type="button" className="solexa-filter-clear" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      <label className="inventory-search-bar">
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, contact, or CNIC..." aria-label="Search customer, contact, or CNIC" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
      </label>

      <section className="erp-card">
        <div className="erp-card-header">
          <div><h2 className="erp-card-title">Customer directory</h2><p className="erp-card-subtitle">Customer accounts stay separate from supplier records.</p></div>
          <Users size={19} className="text-[var(--primary)]" />
        </div>
        <DataTable
          className="inventory-table"
          data={visibleRows}
          searchable={false}
          paginationOnly
          keyExtractor={(row) => row.id}
          onRowClick={setSelected}
          emptyText="No customers match these filters."
          columns={[
            { key: "name", header: "Customer", width: "20%", sortable: true, accessor: (row) => <div><p className="font-semibold text-[var(--text-primary)]">{row.name}</p><p className="text-[var(--text-muted)]">{row.contactNumber || "No contact number"}</p></div> },
            { key: "gender", header: "Gender", width: "12%", sortable: true, accessor: (row) => <span>{row.gender || "—"}</span> },
            { key: "cnicNumber", header: "CNIC number", width: "20%", sortable: true, accessor: (row) => <span>{row.cnicNumber ? formatCnic(row.cnicNumber) : "—"}</span> },
            { key: "salesCount", header: "Sales", width: "10%", align: "right", sortable: true },
            { key: "totalSpent", header: "Total sale", width: "14%", align: "right", sortable: true, accessor: (row) => <span className="font-bold value-positive">{formatCurrency(row.totalSpent)}</span> },
            { key: "lastActivity", header: "Last activity", width: "12%", sortable: true, accessor: (row) => <span className="text-[var(--text-muted)]">{row.lastActivity}</span> },
            { key: "actions", header: "Actions", width: "12%", align: "right", accessor: (row) => <div className="table-row-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="table-icon-button" aria-label={`View ${row.name}`} title="View customer details" onClick={() => setSelected(row)}><Eye size={14} /></button><button type="button" className="table-icon-button" aria-label={`Edit ${row.name}`} title="Edit customer" onClick={() => openEdit(row)}><Pencil size={14} /></button><button type="button" className="table-icon-danger" aria-label={`Delete ${row.name}`} title="Delete customer" onClick={() => setDeleteTarget(row)}><Trash2 size={14} /></button></div> },
          ]}
        />
      </section>

      <Modal open={filterOpen} title="Filter customers" description="Choose the customer records you want to see." onClose={() => setFilterOpen(false)}>
        <div className="filter-inline-row p-5">
          <SelectField label="Customer activity" value={draftActivity} onChange={(event) => setDraftActivity(event.target.value)}>{activityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>
          <SelectField label="Purchase history" value={draftPurchaseHistory} onChange={(event) => setDraftPurchaseHistory(event.target.value)}>{purchaseOptions.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>
          <SelectField label="Registered month" value={draftRegistrationMonth} onChange={(event) => setDraftRegistrationMonth(event.target.value)}><option value="All months">All months</option>{monthOptions.map((option) => <option key={option} value={option}>{monthOptionLabel(option)}</option>)}</SelectField>
          <div className="primitive-dialog-actions filter-inline-actions px-0 pb-0"><Button variant="secondary" className="filter-cancel-button" onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="brand" className="filter-apply-button inventory-add-product-button !text-white" onClick={submitFilters}>Apply filters</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.name} description={selected ? `${selected.code} · ${selected.contactNumber || "No contact number"}` : undefined} onClose={() => setSelected(null)}>{selected && <CustomerDetail customer={selected} transactions={transactions} />}</Modal>

      <Modal open={editorOpen} title={editing ? "Edit customer" : "Add customer"} description="Customer contact numbers must be unique." onClose={() => setEditorOpen(false)}>
        <form onSubmit={submit} className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <Field label="Customer name" value={draft.name} hint={fieldErrors.name} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: undefined })); }} placeholder="e.g. Hamza Khan" />
            <Field label="Contact number" value={draft.contactNumber} hint={fieldErrors.contactNumber} onChange={(event) => { setDraft((current) => ({ ...current, contactNumber: event.target.value })); setFieldErrors((current) => ({ ...current, contactNumber: undefined })); }} placeholder="e.g. 0300 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <SelectField label="Gender" hint={fieldErrors.gender} value={draft.gender} onChange={(event) => { setDraft((current) => ({ ...current, gender: event.target.value })); setFieldErrors((current) => ({ ...current, gender: undefined })); }}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </SelectField>
            <Field label="CNIC number" value={draft.cnicNumber} hint={fieldErrors.cnicNumber} onChange={(event) => { setDraft((current) => ({ ...current, cnicNumber: formatCnic(event.target.value) })); setFieldErrors((current) => ({ ...current, cnicNumber: undefined })); }} placeholder="e.g. 35202-1234567-1" inputMode="numeric" maxLength={15} numberOnly />
          </div>
          <div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" className="cancel-button !bg-[var(--error)] !text-white" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" variant="brand" className="inventory-add-product-button !text-white">{editing ? "Save changes" : "Add customer"}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete customer?" description={deleteTarget ? `${deleteTarget.name} will be removed from the customer directory.` : undefined} confirmLabel="Delete customer" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteCustomer(deleteTarget.id); setDeleteTarget(null); setSelected(null); }} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return <span className="solexa-filter-chip">{label}<button type="button" onClick={onClear} aria-label={`Remove ${label} filter`}><X size={12} /></button></span>;
}

function customerSales(customer: Customer, transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.type === "sale" && (transaction.customerId === customer.id || transaction.party === customer.name)).map((transaction) => ({ ...transaction, time: formatTransactionTime(transaction) }));
}

function CustomerDetail({ customer, transactions }: { customer: CustomerRow; transactions: Transaction[] }) {
  const sales = customerSales(customer, transactions);
  return <div className="p-5"><div className="grid grid-cols-2 gap-3"><Info label="Contact number" value={customer.contactNumber || "Not set"} /><Info label="Gender" value={customer.gender || "Not set"} /><Info label="CNIC number" value={customer.cnicNumber ? formatCnic(customer.cnicNumber) : "Not set"} /><Info label="Sales recorded" value={String(customer.salesCount)} /><Info label="Total sale" value={formatCurrency(customer.totalSpent)} tone="positive" /></div><div className="mt-5"><h3 className="text-sm font-black text-[var(--text-primary)]">Sales history</h3>{sales.length ? <div className="mt-3 grid gap-2">{sales.map((sale) => <div key={sale.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><div><p className="text-xs font-bold text-[var(--text-primary)]">{sale.name}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{sale.time} · {sale.quantity} unit{sale.quantity === 1 ? "" : "s"}</p></div><strong className="text-xs value-positive">{formatCurrency(sale.amount)}</strong></div>)}</div> : <p className="mt-3 text-xs text-[var(--text-muted)]">No sales recorded for this customer.</p>}</div></div>;
}

function Info({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" }) {
  return <div className="rounded-xl bg-[var(--surface-soft)] p-3"><span className="block text-[10px] text-[var(--text-muted)]">{label}</span><strong className={`mt-1 block text-sm ${tone === "positive" ? "value-positive" : "text-[var(--text-primary)]"}`}>{value}</strong></div>;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return getMonthKey(new Date(year, monthNumber - 2, 1));
}

function monthOptionLabel(month: string) {
  return new Intl.DateTimeFormat("en-PK", { month: "long" }).format(new Date(`${month}-01T00:00:00`));
}

function formatCnic(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
