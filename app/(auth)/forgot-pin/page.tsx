"use client";

import Link from "next/link";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";

export default function ForgotPinPage() {
  return <main className="auth-page"><section className="auth-card"><Link href="/pin" className="auth-link">← Back to PIN</Link><div className="mt-7"><p className="erp-eyebrow">PIN recovery</p><h1 className="auth-title">Recover workspace PIN</h1><p className="auth-subtitle">We&apos;ll verify your administrator email before issuing a new PIN.</p></div><form className="auth-form" onSubmit={(event) => event.preventDefault()}><Field label="Administrator email" type="email" required placeholder="admin@company.com" /><Button type="submit">Request PIN reset <span aria-hidden>→</span></Button></form></section></main>;
}
