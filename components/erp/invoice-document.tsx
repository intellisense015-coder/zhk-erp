"use client";

import { formatCurrency } from "../../lib/erp-data";
import type { InvoiceDocumentModel } from "../../lib/invoice-utils";
import { type BusinessProfile } from "../../lib/business-profile";

export function InvoiceDocument({ model, profile }: { model: InvoiceDocumentModel; profile: BusinessProfile | null }) {
  return <article className="invoice-print-root">
    <header className="invoice-document-header">
      <div className="invoice-brand-lockup">
        <ZhkBrandMark />
        <div><h2>ZHK MOBILES</h2><p>MOBILES&nbsp;&nbsp;|&nbsp;&nbsp;ACCESSORIES&nbsp;&nbsp;|&nbsp;&nbsp;GADGETS</p>{profile?.contactNumber && <small>{profile.contactNumber}</small>}</div>
      </div>
      <div className="invoice-heading-meta"><h1>INVOICE</h1><strong>{model.invoiceNumber}</strong><span>Date: {model.date}</span></div>
    </header>

    <div className="invoice-accent-line" aria-hidden="true"><span /></div>

    <section className="invoice-parties">
      <div><p className="invoice-label">{model.partyLabel}</p><strong>{model.party}</strong>{model.contact && <span>{model.contact}</span>}</div>
      <div className="invoice-kind-chip">{model.kind === "sale" ? "Customer invoice" : model.kind === "purchase" ? "Supplier invoice" : "Expense record"}</div>
    </section>

    <table className="invoice-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Amount</th></tr></thead><tbody>{model.lines.map((line, index) => <tr key={`${line.name}-${index}`}><td><strong>{line.name}</strong>{line.detail && <small>{line.detail}</small>}</td><td>{line.quantity}</td><td>{formatCurrency(line.unitPrice)}</td><td>{formatCurrency(line.discount)}</td><td><strong>{formatCurrency(line.amount)}</strong></td></tr>)}</tbody></table>

    <section className="invoice-summary"><div className="invoice-summary-box">{model.adjustments.map((adjustment) => <div key={adjustment.label}><span>{adjustment.label}</span><strong>{adjustment.negative ? "-" : ""}{formatCurrency(adjustment.amount)}</strong></div>)}<div className="invoice-total"><span>Total</span><strong>{formatCurrency(model.total)}</strong></div></div></section>

    <section className="invoice-payment-row"><span className="invoice-payment-icon" aria-hidden="true">▣</span><div><span>Payment</span><strong>{model.paymentSummary}</strong></div></section>
    {model.note && <p className="invoice-note">{model.note}</p>}
    <footer className="invoice-document-footer">Solexa by Intellisense.cloud</footer>
  </article>;
}

function ZhkBrandMark() {
  return <span className="zhk-brand-mark" aria-hidden="true"><i className="zhk-brand-swoosh zhk-brand-swoosh-blue" /><i className="zhk-brand-swoosh zhk-brand-swoosh-red" /><b>ZHK</b></span>;
}
