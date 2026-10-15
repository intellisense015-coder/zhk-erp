"use client";

import Link from "next/link";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Account recovery</p><h1 className="auth-title">Reset password</h1><p className="auth-subtitle">Enter your work email and we&apos;ll send a secure reset link.</p></div><form className="auth-form" onSubmit={(event) => event.preventDefault()}><Field label="Work email" type="email" required placeholder="you@company.com" /><Button type="submit">Send reset link <span aria-hidden>→</span></Button></form></section></main>;
}
