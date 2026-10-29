"use client";

import { ArrowLeft, FileDown, FileText, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { InvoiceDocument } from "../../../components/erp/invoice-document";
import { Button } from "../../../components/primitives/button";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatTransactionTime } from "../../../lib/erp-data";
import { readBusinessProfile, type BusinessProfile } from "../../../lib/business-profile";
import { useErpStore } from "../../../lib/erp-store";

export default function InvoicesPage() {
  return <Suspense fallback={<div className="erp-content"><p className="erp-page-subtitle">Loading invoices...</p></div>}><InvoicePageContent /></Suspense>;
}

function InvoicePageContent() {
  const { transactions } = useErpStore();
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const sales = useMemo(() => transactions.filter((transaction) => transaction.type === "sale"), [transactions]);
  const selected = sales.find((transaction) => transaction.id === params.get("id"));
  useEffect(() => { const timer = window.setTimeout(() => setProfile(readBusinessProfile()), 0); return () => window.clearTimeout(timer); }, []);

  if (!selected) return <div className="erp-content"><div className="erp-page-heading"><div><p className="erp-eyebrow">Sales documents</p><h1 className="erp-page-title">Invoices</h1><p className="erp-page-subtitle">Open an invoice to print it or save it as a PDF.</p></div><FileText size={24} className="text-[var(--primary)]" /></div><section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Invoice register</h2><p className="erp-card-subtitle">Every recorded sale has an invoice number.</p></div></div><DataTable className="inventory-table" data={sales} searchable={false} paginationOnly keyExtractor={(sale) => sale.id} emptyText="No invoices are available yet." columns={[{ key: "invoice", header: "Invoice", sortable: true, accessor: (sale) => <span className="font-bold text-[var(--text-primary)]">{sale.invoiceNumber || `INV-${sale.id.slice(-6).toUpperCase()}`}</span> }, { key: "customer", header: "Customer", sortable: true, accessor: (sale) => sale.party }, { key: "amount", header: "Total", align: "right", sortable: true, accessor: (sale) => formatCurrency(sale.amount) }, { key: "date", header: "Recorded", sortable: true, accessor: (sale) => formatTransactionTime(sale) }, { key: "action", header: "Action", align: "right", accessor: (sale) => <Button variant="secondary" onClick={() => router.push(`/invoices?id=${sale.id}`)}><FileText size={13} />Open</Button> }]} /></section></div>;

  return <div className="erp-content invoice-page"><div className="erp-page-heading invoice-toolbar"><div><button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)]" onClick={() => router.push("/invoices")}><ArrowLeft size={14} />All invoices</button><h1 className="erp-page-title">{selected.invoiceNumber || "Invoice"}</h1><p className="erp-page-subtitle">{selected.party} · {formatCurrency(selected.amount)}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => window.print()}><Printer size={14} />Print</Button><Button variant="brand" onClick={() => window.print()}><FileDown size={14} />Save as PDF</Button></div></div><InvoiceDocument transaction={selected} profile={profile} /></div>;
}
