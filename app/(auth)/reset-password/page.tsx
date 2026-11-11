"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

function passwordUpdateMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("same password") || normalized.includes("different from your old password")) {
    return "Choose a password different from your previous password.";
  }
  if (normalized.includes("current password")) {
    return "Supabase is requiring your current password for this change. Disable that requirement for password recovery in Auth settings, then request a new link.";
  }
  if (normalized.includes("reauth") || normalized.includes("recently signed in")) {
    return "Your recovery session needs to be refreshed. Request a new password reset link and try again.";
  }
  if (normalized.includes("password") && normalized.includes("character")) {
    return message;
  }
  return `We could not update your password: ${message}`;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/dashboard");
  const [invitationSetup, setInvitationSetup] = useState(false);

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const params = new URL(window.location.href).searchParams;
      const nextPath = safeNextPath(params.get("next"));
      setReturnTo(nextPath);
      const isInvitationSetup = params.get("invite") === "1" && nextPath.startsWith("/invite/accept?invitation=");
      const hasRecoveryLink = !isInvitationSetup && params.has("code");
      setInvitationSetup(isInvitationSetup);

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Authentication is not configured for this environment.");
        return;
      }

      let recoveryEvent = false;
      let resolveRecoveryEvent: () => void = () => undefined;
      const recoveryEventPromise = new Promise<void>((resolve) => {
        resolveRecoveryEvent = resolve;
      });
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          recoveryEvent = true;
          resolveRecoveryEvent();
        }
      });

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) {
        authListener.subscription.unsubscribe();
        return;
      }
      if (hasRecoveryLink && !recoveryEvent) {
        await Promise.race([
          recoveryEventPromise,
          new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
        ]);
      }
      authListener.subscription.unsubscribe();

      if (sessionError || !data.session) {
        setError(hasRecoveryLink
          ? "This password reset link is invalid or expired. Request a new link and try again."
          : "Your password reset session is no longer active. Request a new link and try again.");
        return;
      }
      if (hasRecoveryLink && !recoveryEvent) {
        setError("We could not verify this password reset link. Request a new link and try again.");
        return;
      }

      if (!isInvitationSetup) {
        const recoveryStatus = await fetch("/api/auth/password-recovery/status", { cache: "no-store" });
        if (!recoveryStatus.ok) {
          setError("This password reset session is invalid or expired. Request a new link and try again.");
          return;
        }
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      setError("Your recovery session has expired. Please request a new reset link.");
      setSaving(false);
      return;
    }

    const updatePayload = invitationSetup
      ? { password, data: { password_initialized: true } }
      : { password };
    const { error: updateError } = await supabase.auth.updateUser(updatePayload);
    if (updateError) {
      setError(passwordUpdateMessage(updateError.message));
      setSaving(false);
      return;
    }

    await fetch("/api/auth/password-recovery/clear", { method: "POST" });
    await supabase.auth.signOut();
    router.replace(`/login?reset=success&next=${encodeURIComponent(returnTo)}`);
  };

  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">{invitationSetup ? "Solexa workspace access" : "Account recovery"}</p><h1 className="auth-title">{invitationSetup ? "Set your password" : "Choose a new password"}</h1><p className="auth-subtitle">{invitationSetup ? "Create your password first. You will then sign in, set up Microsoft Authenticator, and enter your workspace." : "Use at least 8 characters. Your recovery session will end after the password changes."}</p></div><form className="auth-form" onSubmit={submit}><Field label="New password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><Field label="Confirm password" type="password" required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{error && <p className="auth-field-error" role="alert">{error}</p>}<Button type="submit" variant="brand" loading={saving} disabled={!ready}>{invitationSetup ? "Save password" : "Update password"} <span aria-hidden>→</span></Button></form></section></main>;
}
