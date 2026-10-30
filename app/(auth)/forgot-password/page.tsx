"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSending(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this environment.");
      setSending(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (resetError) {
      setError("We could not process that request. Please try again.");
      return;
    }

    setMessage("If an account exists for that email, a secure reset link has been sent.");
  };

  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Account recovery</p><h1 className="auth-title">Reset password</h1><p className="auth-subtitle">Enter your work email and we&apos;ll send a secure reset link.</p></div><form className="auth-form" onSubmit={submit}><Field label="Work email" type="email" required placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />{error && <p className="auth-field-error" role="alert">{error}</p>}{message && <p className="settings-success" role="status">{message}</p>}<Button type="submit" variant="brand" loading={sending}>Send reset link <span aria-hidden>→</span></Button></form></section></main>;
}
