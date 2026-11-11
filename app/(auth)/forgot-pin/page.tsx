"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";

export default function ForgotPinPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Enter the email address used for your Solexa account.");
      return;
    }

    setSending(true);
    const response = await fetch("/api/auth/mfa-recovery/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const result = await response.json().catch(() => null) as { message?: string } | null;
    setSending(false);

    if (!response.ok) {
      setError(result?.message || "We could not process that request. Please try again.");
      return;
    }

    setMessage(result?.message || "If an account exists for that email, a secure recovery link has been sent. Open it to reset your authenticator, then sign in and scan a new QR code.");
  };

  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Authenticator recovery</p><h1 className="auth-title">Recover workspace PIN</h1><p className="auth-subtitle">We&apos;ll verify your account by email before removing the lost authenticator. You&apos;ll set up a new one after signing in.</p></div><form className="auth-form" onSubmit={submit} noValidate><Field label="Account email" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />{error && <p className="auth-field-error" role="alert">{error}</p>}{message && <p className="settings-success" role="status">{message}</p>}<Button type="submit" variant="brand" loading={sending}>Request PIN reset <span aria-hidden>→</span></Button></form></section></main>;
}
