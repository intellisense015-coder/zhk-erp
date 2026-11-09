"use client";

import { ArrowLeft, Download, Eye, FileText, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { InvoiceDocument } from "../../../components/erp/invoice-document";
import { DataTable } from "../../../components/primitives/table";
import { formatCurrency, formatTransactionTime, type Transaction } from "../../../lib/erp-data";
import { createInvoicePdf } from "../../../lib/invoice-pdf";
import { buildInvoiceModel, getInvoiceKindLabel, getInvoiceNumber, type InvoiceKind, type InvoiceRecord } from "../../../lib/invoice-utils";
import { useErpStore } from "../../../lib/erp-store";

type InvoiceListRecord = { kind: InvoiceKind; record: InvoiceRecord };

export default function InvoicesPage() {
  return <Suspense fallback={<div className="erp-content"><p className="erp-page-subtitle">Loading invoices...</p></div>}><InvoicePageContent /></Suspense>;
}

function InvoicePageContent() {
  const { transactions } = useErpStore();
  const router = useRouter();
  const params = useSearchParams();
  const invoiceRows = useMemo<InvoiceListRecord[]>(() => transactions
    .filter((transaction) => transaction.type === "sale")
    .map((record) => ({ kind: "sale" as const, record }))
    .sort((a, b) => Date.parse(b.record.createdAt ?? b.record.date) - Date.parse(a.record.createdAt ?? a.record.date)), [transactions]);
  const selectedEntry = invoiceRows.find((entry) => entry.record.id === params.get("id") && (!params.get("type") || entry.kind === params.get("type")));
  const invoiceSources = invoiceRows.map((entry) => entry.record);
  const selectedModel = selectedEntry ? buildInvoiceModel(selectedEntry.kind, selectedEntry.record, getInvoiceNumber(selectedEntry.record, invoiceSources)) : null;
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
  if (!selectedEntry || !selectedModel) return <div className="erp-content">
    <div className="erp-page-heading"><div><p className="erp-eyebrow">Documents</p><h1 className="erp-page-title">Invoices</h1><p className="erp-page-subtitle">View, print, download, and share sales invoices.</p></div><FileText size={24} className="text-[var(--primary)]" /></div>
    <section className="erp-card"><div className="erp-card-header"><div><h2 className="erp-card-title">Sales invoices</h2><p className="erp-card-subtitle">Every recorded sale can be opened as a minimalist invoice.</p></div></div><DataTable className="inventory-table" data={invoiceRows} searchable={false} paginationOnly keyExtractor={(entry) => `${entry.kind}-${entry.record.id}`} emptyText="No sales invoices are available yet." columns={[{ key: "invoice", header: "Invoice", sortable: true, accessor: (entry) => <span className="font-bold text-[var(--text-primary)]">{getInvoiceNumber(entry.record, invoiceSources)}</span> }, { key: "type", header: "Type", sortable: true, accessor: (entry) => <span className="invoice-register-type">{getInvoiceKindLabel(entry.kind)}</span> }, { key: "party", header: "Customer", sortable: true, accessor: (entry) => (entry.record as Transaction).party }, { key: "amount", header: "Total", align: "right", sortable: true, accessor: (entry) => formatCurrency((entry.record as Transaction).amountDue ?? (entry.record as Transaction).amount) }, { key: "date", header: "Date", sortable: true, accessor: (entry) => formatTransactionTime(entry.record as Transaction) }, { key: "action", header: "View", align: "right", accessor: (entry) => <button type="button" className="table-icon-button" aria-label={`View ${getInvoiceKindLabel(entry.kind).toLowerCase()} invoice`} title="View invoice" onClick={() => openInvoice(entry)}><Eye size={14} /></button> }]} /></section>
  </div>;

  return <div className="erp-content invoice-page"><div className="erp-page-heading invoice-toolbar"><div><button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)]" onClick={() => router.push("/invoices")}><ArrowLeft size={14} />All invoices</button><h1 className="erp-page-title">{selectedModel.invoiceNumber}</h1><p className="erp-page-subtitle">{getInvoiceKindLabel(selectedEntry.kind)} · {selectedModel.party} · {formatCurrency(selectedModel.total)}</p></div><div className="invoice-action-bar" aria-label="Invoice actions"><button type="button" className="invoice-action-button" onClick={() => window.print()}><span className="invoice-action-icon"><Printer size={17} /></span><span>Print</span></button><button type="button" className="invoice-action-button" onClick={downloadPdf}><span className="invoice-action-icon"><Download size={17} /></span><span>Download PDF</span></button></div></div><InvoiceDocument model={selectedModel} /></div>;
}
