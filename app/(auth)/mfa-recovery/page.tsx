"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/primitives/button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type RecoveryState = "loading" | "ready" | "done";

export default function MfaRecoveryPage() {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState>("loading");
  const [email, setEmail] = useState("");
  const [factorCount, setFactorCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRecoverySession = async () => {
      // A normal authenticated session must never be enough to remove MFA.
      // The email link supplies the one-time PKCE code (or recovery marker).
      const recoveryLink = new URL(window.location.href);
      const hasRecoveryHint = recoveryLink.searchParams.has("code")
        && recoveryLink.searchParams.has("proof");
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }

      let recoveryEvent = false;
      let resolveRecoveryEvent: (authorized: boolean) => void = () => undefined;
      const recoveryEventPromise = new Promise<boolean>((resolve) => {
        resolveRecoveryEvent = resolve;
      });
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          recoveryEvent = true;
          resolveRecoveryEvent(true);
        }
      });

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (hasRecoveryHint && !recoveryEvent) {
        await Promise.race([
          recoveryEventPromise,
          new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 2000)),
        ]);
      }
      authListener.subscription.unsubscribe();

      if (!hasRecoveryHint || !recoveryEvent || sessionError || !data.session) {
        router.replace("/login");
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factorsError || !factors) {
        setError("We could not inspect your authenticator setup. Please request a new recovery link.");
        setState("ready");
        return;
      }

      setEmail(data.session.user.email ?? "");
      setFactorCount(factors.totp.filter((factor) => factor.status === "verified").length);
      setState("ready");
    };

    void loadRecoverySession();
    return () => { active = false; };
  }, [router]);

  const resetAuthenticator = async () => {
    setError(null);
    setRemoving(true);
    const proof = new URL(window.location.href).searchParams.get("proof");
    if (!proof) {
      setError("The recovery link is invalid or expired. Please request a new link.");
      setRemoving(false);
      return;
    }

    const response = await fetch("/api/auth/mfa-recovery/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof }),
    });
    const result = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setError(result?.message || "The recovery link could not reset your authenticator. Please request a new link.");
      setRemoving(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut({ scope: "local" });
    router.replace("/login");
  };

  return <main className="auth-page"><section className="auth-card" aria-live="polite"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Authenticator recovery</p><h1 className="auth-title">Reset your authenticator</h1>{state === "loading" && <p className="auth-subtitle">Verifying your secure recovery link…</p>}{state !== "loading" && state !== "done" && <><p className="auth-subtitle">{email ? `${email} · ` : ""}This removes the lost Microsoft Authenticator factor. Your next sign-in will show a fresh QR code for setup.</p>{error && <p className="auth-field-error" role="alert">{error}</p>}{!error && factorCount === 0 && <p className="settings-success" role="status">No verified authenticator was found. You can sign in and set one up from the MFA screen.</p>}{!error && factorCount > 0 && <Button type="button" variant="brand" loading={removing} onClick={() => void resetAuthenticator()}>Reset authenticator <span aria-hidden>→</span></Button>}</>}</div></section></main>;
}
