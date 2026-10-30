"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        router.replace("/login");
        return;
      }
      setReady(true);
    };
    void verifyRecoverySession();
    return () => { active = false; };
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this environment.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("We could not update your password. Please request a new link.");
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  };

  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Account recovery</p><h1 className="auth-title">Choose a new password</h1><p className="auth-subtitle">Use at least 8 characters. Your recovery session will end after the password changes.</p></div><form className="auth-form" onSubmit={submit}><Field label="New password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><Field label="Confirm password" type="password" required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{error && <p className="auth-field-error" role="alert">{error}</p>}<Button type="submit" variant="brand" loading={saving} disabled={!ready}>Update password <span aria-hidden>→</span></Button></form></section></main>;
}
