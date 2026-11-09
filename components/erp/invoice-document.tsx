"use client";

import { formatCurrency } from "../../lib/erp-data";
import { formatInvoiceDate, type InvoiceDocumentModel } from "../../lib/invoice-utils";

export function InvoiceDocument({ model }: { model: InvoiceDocumentModel }) {
  return <article className="invoice-print-root">
    <header className="invoice-ticket-brand">
      <div className="invoice-ticket-brand-copy"><ZhkBrandMark /><div><h2>ZHK MOBILES</h2><p>mobiles&nbsp;&nbsp;|&nbsp;&nbsp;accessories&nbsp;&nbsp;|&nbsp;&nbsp;gadgets</p></div></div>
      <div className="invoice-ticket-label"><span>INVOICE</span><strong>{model.invoiceNumber}</strong></div>
    </header>

    <section className="invoice-ticket-thanks"><h1>Thank you!</h1><p>Your purchase has been recorded<br />successfully</p></section>

    <div className="invoice-ticket-divider" aria-hidden="true" />

    <section className="invoice-ticket-stats">
      <div><span>INVOICE ID</span><strong>{model.invoiceNumber}</strong><small>{formatInvoiceDate(model.date)}</small></div>
      <div><span>AMOUNT</span><strong>{formatCurrency(model.total)}</strong></div>
    </section>

    <section className="invoice-ticket-customer"><span>{model.partyLabel}</span><strong>{model.party}</strong>{model.contact && <small>{model.contact}</small>}</section>

    <table className="invoice-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{model.lines.map((line, index) => <tr key={`${line.name}-${index}`}><td><strong>{line.name}</strong>{line.detail && <small>{line.detail}</small>}</td><td>{line.quantity}</td><td><strong>{formatCurrency(line.amount)}</strong></td></tr>)}</tbody></table>

    <section className="invoice-summary"><div className="invoice-summary-box">{model.adjustments.map((adjustment) => <div key={adjustment.label}><span>{adjustment.label}</span><strong>{adjustment.negative ? "-" : ""}{formatCurrency(adjustment.amount)}</strong></div>)}<div className="invoice-total"><span>Total</span><strong>{formatCurrency(model.total)}</strong></div></div></section>

    {model.note && <p className="invoice-note">{model.note}</p>}
    <footer className="invoice-document-footer">Solexa by Intellisense.cloud</footer>
  </article>;
}

function ZhkBrandMark() {
  return <span className="zhk-brand-mark" aria-hidden="true"><i className="zhk-brand-swoosh zhk-brand-swoosh-blue" /><i className="zhk-brand-swoosh zhk-brand-swoosh-red" /><b>ZHK</b></span>;
}
