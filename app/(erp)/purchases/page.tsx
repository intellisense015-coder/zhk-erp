"use client";

import { ArrowDownLeft, ClipboardList, Eye, Filter, PackagePlus, Receipt, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { KpiCard } from "../../../components/erp/kpi-card";
import { Button } from "../../../components/primitives/button";
import { Modal, SelectField } from "../../../components/primitives/primitives";
import { DataTable, TableBadge } from "../../../components/primitives/table";
import { formatCompactCurrency, formatCurrency, formatTransactionTime, getMonthOptions } from "../../../lib/erp-data";
import { useErpStore } from "../../../lib/erp-store";

export default function PurchasesPage() {
  const { products, transactions, suppliers, supplierPayments } = useErpStore();
  const router = useRouter();
  const purchases = useMemo(() => transactions.filter((transaction) => transaction.type === "purchase"), [transactions]);
  const monthOptions = useMemo(() => getMonthOptions(purchases), [purchases]);
  const supplierOptions = useMemo(() => [
    { value: "all", label: "All suppliers" },
    ...Array.from(new Set(purchases.map((purchase) => purchase.party).filter(Boolean))).sort().map((value) => ({ value, label: value })),
  ], [purchases]);
  const [month, setMonth] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [draftMonth, setDraftMonth] = useState("all");
  const [draftSupplier, setDraftSupplier] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => purchases.filter((purchase) => {
    const matchesMonth = month === "all" || purchase.month === month;
    const matchesSupplier = supplier === "all" || purchase.party === supplier;
    return matchesMonth && matchesSupplier;
  }), [month, purchases, supplier]);
  const searched = useMemo(() => visible.filter((purchase) => `${purchase.name} ${purchase.party} ${purchase.supplierCompany ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [search, visible]);
  const totalPurchased = useMemo(() => purchases.reduce((sum, purchase) => sum + purchase.amount, 0), [purchases]);
  const totalUnits = useMemo(() => purchases.reduce((sum, purchase) => sum + purchase.quantity, 0), [purchases]);
  const totalPaid = useMemo(() => supplierPayments.reduce((sum, payment) => sum + payment.amount, 0), [supplierPayments]);
  const outstanding = useMemo(() => suppliers.reduce((sum, supplierRecord) => {
    const purchased = purchases.filter((purchase) => purchase.supplierId === supplierRecord.id || purchase.party === supplierRecord.name).reduce((supplierTotal, purchase) => supplierTotal + purchase.amount, 0);
    const paid = supplierPayments.filter((payment) => payment.supplierId === supplierRecord.id).reduce((supplierTotal, payment) => supplierTotal + payment.amount, 0);
    return sum + Math.max(0, purchased + (supplierRecord.openingBalance ?? 0) - paid);
  }, 0), [purchases, supplierPayments, suppliers]);

  const applyFilter = () => {
    setMonth(draftMonth);
    setSupplier(draftSupplier);
    setFilterOpen(false);
  };
  const clearFilter = () => {
    setMonth("all");
    setSupplier("all");
    setDraftMonth("all");
    setDraftSupplier("all");
  };

  return (
    <div className="erp-content">
      <div className="erp-page-heading">
        <div>
          <h1 className="erp-page-title">Purchase history</h1>
          <p className="erp-page-subtitle">Review stock received from suppliers and its purchase history.</p>
        </div>
        <Button variant="secondary" onClick={() => { setDraftMonth(month); setDraftSupplier(supplier); setFilterOpen(true); }}>
          <Filter size={15} />
          Filters
        </Button>
      </div>

      <div className="solexa-filter-chips">
        {month !== "all" && <span className="solexa-filter-chip">{monthOptions.find((option) => option.value === month)?.label ?? month}<button type="button" onClick={() => { setMonth("all"); setDraftMonth("all"); }} aria-label="Remove month filter"><X size={13} /></button></span>}
        {supplier !== "all" && <span className="solexa-filter-chip">{supplier}<button type="button" onClick={() => { setSupplier("all"); setDraftSupplier("all"); }} aria-label="Remove supplier filter"><X size={13} /></button></span>}
        {(month !== "all" || supplier !== "all") && <button type="button" className="solexa-filter-clear" onClick={clearFilter}>Clear all</button>}
      </div>

      <section className="erp-grid-4 mb-[18px]">
        <KpiCard label="Purchase records" value={String(purchases.length)} note="Recorded supplier purchases" icon={<ClipboardList size={18} />} />
        <KpiCard label="Purchased value" value={formatCompactCurrency(totalPurchased)} note="Total stock purchase value" icon={<Receipt size={18} />} tone="error" />
        <KpiCard label="Units received" value={totalUnits.toLocaleString("en-PK")} note="Units added to inventory" icon={<PackagePlus size={18} />} tone="success" />
        <KpiCard label="Outstanding" value={formatCompactCurrency(outstanding)} note={`${formatCurrency(totalPaid)} paid to suppliers`} icon={<ArrowDownLeft size={18} />} tone="error" />
      </section>

      <label className="inventory-search-bar">
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or supplier..." aria-label="Search product or supplier" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
      </label>

      <section className="erp-card">
        <div className="erp-card-header">
          <div>
            <h2 className="erp-card-title">All purchases</h2>
            <p className="erp-card-subtitle">{searched.length} purchase record{searched.length === 1 ? "" : "s"} in the selected period. Supplier payments are tracked separately.</p>
          </div>
          <Receipt size={19} className="text-[var(--primary)]" />
        </div>
        <DataTable
          className="inventory-table"
          data={searched}
          searchable={false}
          paginationOnly
          keyExtractor={(purchase) => purchase.id}
          emptyText="No purchase records found. Add stock from Inventory to create purchase history."
          columns={[
            { key: "name", header: "Product", width: "14.2857%", sortable: true, accessor: (purchase) => <div><p className="font-semibold text-[var(--text-primary)]">{purchase.name}</p><p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">{products.find((product) => product.id === purchase.productId)?.color || "Unspecified"}</p></div> },
            { key: "party", header: "Supplier", width: "14.2857%", sortable: true, accessor: (purchase) => <span className="font-medium text-[var(--text-secondary)]">{purchase.party}</span> },
            { key: "quantity", header: "Qty", width: "14.2857%", sortable: true, align: "right", accessor: (purchase) => `${purchase.quantity} units` },
            { key: "unitCost", header: "Unit cost", width: "14.2857%", sortable: true, align: "right", accessor: (purchase) => formatCurrency(purchase.unitCost ?? (purchase.quantity ? purchase.amount / purchase.quantity : 0)) },
            { key: "amount", header: "Purchased", width: "14.2857%", sortable: true, align: "right", accessor: (purchase) => <span className="font-bold text-[var(--text-primary)]">{formatCurrency(purchase.amount)}</span> },
            { key: "outstandingAmount", header: "Outstanding", width: "12%", sortable: true, align: "right", accessor: (purchase) => <TableBadge tone={(purchase.outstandingAmount ?? purchase.amount) > 0 ? "danger" : "success"}>{formatCurrency(purchase.outstandingAmount ?? Math.max(0, purchase.amount - (purchase.paidAmount ?? 0)))}</TableBadge> },
            { key: "funding", header: "Funding", width: "12%", sortable: true, accessor: (purchase) => purchase.fundingSource === "capital" ? <TableBadge tone="success">Capital</TableBadge> : purchase.fundingSource === "supplier-credit" ? <TableBadge tone="warning">Credit</TableBadge> : <span className="text-[var(--text-muted)]">Other</span> },
            { key: "date", header: "Recorded", width: "12%", sortable: true, accessor: (purchase) => <span className="text-[var(--text-muted)]">{formatTransactionTime(purchase)}</span> },
            { key: "actions", header: "View", align: "right", accessor: (purchase) => <button type="button" className="table-icon-button" aria-label={`View invoice for ${purchase.party}`} title="View invoice" onClick={(event) => { event.stopPropagation(); router.push(`/invoices?id=${purchase.id}&type=purchase`); }}><Eye size={14} /></button> },
          ]}
        />
      </section>

      <Modal open={filterOpen} title="Filter purchases" description="Choose the supplier and month you want to review." onClose={() => setFilterOpen(false)}>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Supplier" value={draftSupplier} onChange={(event) => setDraftSupplier(event.target.value)}>{supplierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
            <SelectField label="Month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          </div>
          <div className="primitive-dialog-actions px-0 pb-0">
            <Button variant="secondary" className="cancel-button !bg-[var(--error)] !text-white" onClick={() => setFilterOpen(false)}>Cancel</Button>
            <Button variant="brand" className="inventory-add-product-button !text-white" onClick={applyFilter}>Apply filters</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
