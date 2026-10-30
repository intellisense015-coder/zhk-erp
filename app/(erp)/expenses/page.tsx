"use client";

import { CircleDollarSign, Eye, Filter, Pencil, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Button } from "../../../components/primitives/button";
import { ConfirmDialog, Field, Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatCompactCurrency, formatLongDate, type Expense } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

type ExpenseDraft = { category: string; description: string; amount: string; paymentMethod: string; note: string };

const blankDraft: ExpenseDraft = { category: "Other", description: "", amount: "", paymentMethod: "Cash", note: "" };

export default function ExpensesPage() {
  const { expenses, expenseCategories, addExpense, updateExpense, deleteExpense, addExpenseCategory } = useErpStore();
  const router = useRouter();
  const [draft, setDraft] = useState<ExpenseDraft>(blankDraft);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setCurrentMonth(new Date().toISOString().slice(0, 7)), 0); return () => window.clearTimeout(timer); }, []);

  const visible = useMemo(() => expenses.filter((expense) => {
    const query = search.trim().toLowerCase();
    return (categoryFilter === "All categories" || expense.category === categoryFilter) && (!query || `${expense.category} ${expense.description} ${expense.note ?? ""}`.toLowerCase().includes(query));
  }), [categoryFilter, expenses, search]);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const thisMonth = currentMonth ? expenses.filter((expense) => expense.month === currentMonth).reduce((sum, expense) => sum + expense.amount, 0) : 0;
  const largest = expenses.reduce((max, expense) => Math.max(max, expense.amount), 0);

  const openCreate = () => { setEditing(null); setDraft(blankDraft); setError(null); setEditorOpen(true); };
  const openCategory = () => { setCategoryName(""); setCategoryError(null); setCategoryOpen(true); };
  const submitCategory = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const result = addExpenseCategory(categoryName); if (!result.ok) { setCategoryError(result.message); return; } setCategoryOpen(false); setCategoryName(""); setCategoryError(null); };
  const openEdit = (expense: Expense) => { setEditing(expense); setDraft({ category: expense.category, description: expense.description, amount: String(expense.amount), paymentMethod: expense.paymentMethod ?? "Cash", note: expense.note ?? "" }); setError(null); setEditorOpen(true); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { category: draft.category, description: draft.description, amount: Number(draft.amount), paymentMethod: draft.paymentMethod, note: draft.note };
    const result = editing ? updateExpense(editing.id, values) : addExpense(values);
    if (!result.ok) { setError(result.message); return; }
    setEditorOpen(false);
    setError(null);
  };

  return <div className="erp-content expenses-page">
    <div className="erp-page-heading"><div><p className="erp-eyebrow">Financial operations</p><h1 className="erp-page-title">Expenses</h1><p className="erp-page-subtitle">Track business costs and understand their effect on net profit.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setFilterOpen(true)}><Filter size={14} />Filters</Button><Button variant="secondary" onClick={openCategory}><Plus size={14} />Add category</Button><Button variant="brand" onClick={openCreate}><Plus size={14} />Add expense</Button></div></div>
    <div className="kpi-grid inventory-kpis inventory-kpis-four mb-[18px]"><KpiCard label="Total expenses" value={formatCompactCurrency(total)} note="All recorded costs" icon={<ReceiptText size={16} />} tone="error" /><KpiCard label="This month" value={formatCompactCurrency(thisMonth)} note="Current month spending" icon={<CircleDollarSign size={16} />} tone="error" /><KpiCard label="Expense records" value={String(expenses.length)} note="Recorded business costs" icon={<ReceiptText size={16} />} /><KpiCard label="Largest expense" value={formatCompactCurrency(largest)} note="Highest single record" icon={<CircleDollarSign size={16} />} /></div>
    <label className="inventory-search-bar"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expense or category..." aria-label="Search expenses" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Expense ledger</h2><p className="erp-card-subtitle">Expenses are included in net profit calculations.</p></div><ReceiptText size={19} className="text-[var(--primary)]" /></div><DataTable className="inventory-table" data={visible} searchable={false} paginationOnly keyExtractor={(expense) => expense.id} emptyText="No expenses recorded yet." columns={[{ key: "category", header: "Category", sortable: true, accessor: (expense) => <span className="font-semibold text-[var(--text-primary)]">{expense.category}</span> }, { key: "description", header: "Description", sortable: true, accessor: (expense) => <span className="font-semibold text-[var(--text-primary)]">{expense.description}</span> }, { key: "amount", header: "Amount", align: "right", sortable: true, accessor: (expense) => <span className="font-bold value-negative">{formatCurrency(expense.amount)}</span> }, { key: "paymentMethod", header: "Paid by", sortable: true, accessor: (expense) => expense.paymentMethod || "—" }, { key: "date", header: "Date", sortable: true, accessor: (expense) => formatLongDate(expense.date) }, { key: "actions", header: "Actions", align: "right", accessor: (expense) => <div className="table-row-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="table-icon-button" aria-label={`View invoice for ${expense.description}`} title="View invoice" onClick={() => router.push(`/invoices?id=${expense.id}&type=expense`)}><Eye size={14} /></button><button type="button" className="table-icon-button" aria-label={`Edit ${expense.description}`} title="Edit expense" onClick={() => openEdit(expense)}><Pencil size={14} /></button><button type="button" className="table-icon-danger" aria-label={`Delete ${expense.description}`} title="Delete expense" onClick={() => setDeleteTarget(expense)}><Trash2 size={14} /></button></div> }]} /></section>
    <Modal open={filterOpen} title="Filter expenses" description="Choose which expense categories to display." onClose={() => setFilterOpen(false)}><div className="p-5"><SelectField label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="All categories">All categories</option>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</SelectField><div className="primitive-dialog-actions px-0 pb-0"><Button variant="secondary" onClick={() => setFilterOpen(false)}>Close</Button></div></div></Modal>
    <Modal open={categoryOpen} title="Add expense category" description="Create a category that will appear in expense forms and filters." onClose={() => setCategoryOpen(false)}><form onSubmit={submitCategory} className="grid gap-4 p-5"><Field label="Category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Insurance" autoFocus />{categoryError && <p className="rounded-xl bg-[var(--error-glow)] px-3 py-2 text-[10px] font-bold text-[var(--error)]">{categoryError}</p>}<div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Add category</Button></div></form></Modal>
    <Modal open={editorOpen} title={editing ? "Edit expense" : "Add expense"} description="Record a business cost for the expense ledger." onClose={() => setEditorOpen(false)}><form onSubmit={submit} className="grid gap-4 p-5"><div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1"><SelectField label="Category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</SelectField><Field label="Amount" type="number" min={0.01} step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} /></div><Field label="Description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. Shop electricity bill" /><SelectField label="Payment method" value={draft.paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value }))}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Other</option></SelectField><Field label="Note (optional)" value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional reference" />{error && <p className="rounded-xl bg-[var(--error-glow)] px-3 py-2 text-[10px] font-bold text-[var(--error)]">{error}</p>}<div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" variant="brand">{editing ? "Save changes" : "Add expense"}</Button></div></form></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete expense?" description={deleteTarget ? `${deleteTarget.description} will be removed from the expense ledger.` : undefined} confirmLabel="Delete expense" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteExpense(deleteTarget.id); setDeleteTarget(null); }} />
  </div>;
}
