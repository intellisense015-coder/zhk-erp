"use client";

import { ArrowLeft, Download, Eye, FileText, MessageCircle, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { InvoiceDocument } from "../../../components/erp/invoice-document";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatLongDate, formatTransactionTime, type Expense, type Transaction } from "../../../lib/erp-data";
import { readBusinessProfile, type BusinessProfile } from "../../../lib/business-profile";
import { createInvoicePdf } from "../../../lib/invoice-pdf";
import { buildInvoiceModel, getInvoiceKindLabel, getInvoiceNumber, type InvoiceKind, type InvoiceRecord } from "../../../lib/invoice-utils";
import { useErpStore } from "../../../lib/erp-store";

type InvoiceListRecord = { kind: InvoiceKind; record: InvoiceRecord };

export default function InvoicesPage() {
  return <Suspense fallback={<div className="erp-content"><p className="erp-page-subtitle">Loading invoices...</p></div>}><InvoicePageContent /></Suspense>;
}

function InvoicePageContent() {
  const { transactions, expenses } = useErpStore();
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const invoiceRows = useMemo<InvoiceListRecord[]>(() => [
    ...transactions.filter((transaction) => transaction.type === "sale" || transaction.type === "purchase").map((record) => ({ kind: record.type as "sale" | "purchase", record })),
    ...expenses.map((record) => ({ kind: "expense" as const, record })),
  ].sort((a, b) => Date.parse(b.record.createdAt ?? b.record.date) - Date.parse(a.record.createdAt ?? a.record.date)), [expenses, transactions]);
  const selectedEntry = invoiceRows.find((entry) => entry.record.id === params.get("id") && (!params.get("type") || entry.kind === params.get("type")));
  const invoiceSources = invoiceRows.map((entry) => entry.record);
  const selectedModel = selectedEntry ? buildInvoiceModel(selectedEntry.kind, selectedEntry.record, getInvoiceNumber(selectedEntry.record, invoiceSources)) : null;
  useEffect(() => { const timer = window.setTimeout(() => setProfile(readBusinessProfile()), 0); return () => window.clearTimeout(timer); }, []);

  const openInvoice = (entry: InvoiceListRecord) => router.push(`/invoices?id=${entry.record.id}&type=${entry.kind}`);
  const downloadPdf = () => {
    if (!selectedModel) return;
    const url = URL.createObjectURL(createInvoicePdf(selectedModel));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedModel.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const shareOnWhatsApp = async () => {
    if (!selectedModel) return;
    const text = `ZHK MOBILES\n${selectedModel.invoiceNumber}\n${selectedModel.party}\nTotal: ${formatCurrency(selectedModel.total)}\nDate: ${selectedModel.date}`;
    const file = new File([createInvoicePdf(selectedModel)], `${selectedModel.invoiceNumber}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: selectedModel.invoiceNumber, text, files: [file] }); return; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (!selectedEntry || !selectedModel) return <div className="erp-content">
    <div className="erp-page-heading"><div><p className="erp-eyebrow">Documents</p><h1 className="erp-page-title">Invoices</h1><p className="erp-page-subtitle">View, print, download, and share sales, purchase, and expense records.</p></div><FileText size={24} className="text-[var(--primary)]" /></div>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Invoice register</h2><p className="erp-card-subtitle">Every recorded sale, purchase, and expense can be opened as a minimalist invoice.</p></div></div><DataTable className="inventory-table" data={invoiceRows} searchable={false} paginationOnly keyExtractor={(entry) => `${entry.kind}-${entry.record.id}`} emptyText="No invoice records are available yet." columns={[{ key: "invoice", header: "Invoice", sortable: true, accessor: (entry) => <span className="font-bold text-[var(--text-primary)]">{getInvoiceNumber(entry.record, invoiceSources)}</span> }, { key: "type", header: "Type", sortable: true, accessor: (entry) => <span className="invoice-register-type">{getInvoiceKindLabel(entry.kind)}</span> }, { key: "party", header: "Customer / party", sortable: true, accessor: (entry) => entry.kind === "expense" ? (entry.record as Expense).description : (entry.record as Transaction).party }, { key: "amount", header: "Total", align: "right", sortable: true, accessor: (entry) => formatCurrency(entry.kind === "expense" ? (entry.record as Expense).amount : (entry.record as Transaction).amountDue ?? (entry.record as Transaction).amount) }, { key: "date", header: "Date", sortable: true, accessor: (entry) => entry.kind === "expense" ? formatLongDate(entry.record.date) : formatTransactionTime(entry.record as Transaction) }, { key: "action", header: "View", align: "right", accessor: (entry) => <button type="button" className="table-icon-button" aria-label={`View ${getInvoiceKindLabel(entry.kind).toLowerCase()} invoice`} title="View invoice" onClick={() => openInvoice(entry)}><Eye size={14} /></button> }]} /></section>
  </div>;

  return <div className="erp-content invoice-page"><div className="erp-page-heading invoice-toolbar"><div><button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)]" onClick={() => router.push("/invoices")}><ArrowLeft size={14} />All invoices</button><h1 className="erp-page-title">{selectedModel.invoiceNumber}</h1><p className="erp-page-subtitle">{getInvoiceKindLabel(selectedEntry.kind)} · {selectedModel.party} · {formatCurrency(selectedModel.total)}</p></div><div className="invoice-action-bar" aria-label="Invoice actions"><button type="button" className="invoice-action-button" onClick={() => window.print()}><span className="invoice-action-icon"><Printer size={17} /></span><span>Print</span></button><button type="button" className="invoice-action-button" onClick={downloadPdf}><span className="invoice-action-icon"><Download size={17} /></span><span>Download PDF</span></button><button type="button" className="invoice-action-button invoice-action-whatsapp" onClick={shareOnWhatsApp}><span className="invoice-action-icon"><MessageCircle size={17} /></span><span>WhatsApp</span></button></div></div><InvoiceDocument model={selectedModel} profile={profile} /></div>;
}
