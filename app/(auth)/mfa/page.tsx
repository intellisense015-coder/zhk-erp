"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/primitives/button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type MfaMode = "loading" | "enroll" | "challenge";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<MfaMode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("/dashboard");

  useEffect(() => {
    let active = true;
    const loadMfaState = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }

      const nextPath = safeNextPath(new URL(window.location.href).searchParams.get("next"));
      setReturnTo(nextPath);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      setEmail(sessionData.session.user.email ?? "");
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (assuranceError || factorsError || !assurance || !factors) {
      setError("We could not verify your Microsoft Authenticator status. Please sign in again.");
        return;
      }
      if (assurance.currentLevel === "aal2") {
        router.replace(nextPath);
        return;
      }

      const verifiedTotp = factors.totp.find((factor) => factor.status === "verified");
      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setMode("challenge");
      } else {
        setMode("enroll");
      }
    };

    void loadMfaState();
    return () => { active = false; };
  }, [router]);

  const startEnrollment = async () => {
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this environment.");
      setLoading(false);
      return;
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError("Unable to inspect your Microsoft Authenticator setup.");
      setLoading(false);
      return;
    }

    for (const factor of factors.all.filter((candidate) => candidate.factor_type === "totp" && candidate.status === "unverified")) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (cleanupError) {
        setError("Unable to reset the unfinished Microsoft Authenticator setup. Please reload and try again.");
        setLoading(false);
        return;
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Solexa Microsoft Authenticator",
    });
    setLoading(false);
    if (enrollError || !data?.totp) {
      setError(enrollError?.message || "Unable to start Microsoft Authenticator setup.");
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the current six-digit code from Microsoft Authenticator.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !factorId) {
      setError("Microsoft Authenticator setup is not ready. Please reload and try again.");
      setLoading(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message || "Unable to create a Microsoft Authenticator challenge.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError("That Microsoft Authenticator code is invalid or expired. Enter the newest code and try again.");
      setLoading(false);
      return;
    }

    await supabase.auth.refreshSession();
    router.replace(returnTo);
  };

  const isEnrollmentReady = mode === "enroll" && Boolean(qrCode);
  const title = mode === "challenge" ? "Verify Microsoft Authenticator" : "Connect Microsoft Authenticator";
  const subtitle = mode === "challenge"
    ? "Enter your current six-digit code to continue."
    : "Use Microsoft Authenticator to protect this workspace.";

  return (
    <main className="auth-page">
      <section className="auth-card mfa-card" aria-live="polite">
        <p className="erp-eyebrow">Solexa security</p>
        <h1 className="auth-title">{mode === "loading" ? "Checking security…" : title}</h1>
        <p className="auth-subtitle mfa-subtitle">{email ? `${email} · ` : ""}{subtitle}</p>

        {mode === "loading" && <p className="mfa-status">Checking your Microsoft Authenticator factor…</p>}

        {mode === "enroll" && !isEnrollmentReady && (
          <div className="mfa-intro">
            <Button type="button" variant="brand" loading={loading} onClick={startEnrollment}>Set up Microsoft Authenticator</Button>
          </div>
        )}

        {isEnrollmentReady && (
          <div className="mfa-enrollment">
            <div className="mfa-qr-frame"><img src={qrCode} alt="QR code for Solexa Microsoft Authenticator setup" width={220} height={220} /></div>
            <p className="mfa-helper">Open Microsoft Authenticator, scan this QR code, then enter the six-digit code it generates.</p>
            <p className="mfa-secret"><span>Microsoft Authenticator setup key</span><code>{secret}</code></p>
          </div>
        )}

        {(mode === "challenge" || isEnrollmentReady) && (
          <form className="mfa-form" onSubmit={verifyCode} noValidate>
            <label htmlFor="mfa-code">Microsoft Authenticator code</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" disabled={loading} />
            {error && <p className="auth-field-error" role="alert">{error}</p>}
            <Button type="submit" variant="brand" loading={loading}>{mode === "challenge" ? "Verify and open workspace" : "Verify Microsoft Authenticator"}</Button>
          </form>
        )}

        {mode !== "loading" && !isEnrollmentReady && error && <p className="auth-field-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
