"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { passwordSetupPath } from "../../../lib/supabase/access";

function safeInvitationId(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Securing your session…");

  useEffect(() => {
    let active = true;

    const finish = async () => {
      const url = new URL(window.location.href);
      const invitationId = safeInvitationId(url.searchParams.get("invitation"));
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const hasLegacySessionToken = Boolean(hashParams.get("access_token") || hashParams.get("refresh_token"));

      // Remove any legacy implicit-flow fragment before doing anything else.
      // Tokens are never rendered, logged, or copied into an application URL.
      if (url.hash) {
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/login?error=auth_unavailable");
        return;
      }

      // Legacy implicit-flow links are deliberately rejected. Even though we
      // scrub the fragment immediately, a bearer token should never become a
      // session through this client route. New invitations use /auth/confirm.
      if (hasLegacySessionToken) {
        router.replace("/login?error=invitation_expired");
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        router.replace("/login?error=invitation_expired");
        return;
      }

      setMessage("Session secured. Continuing…");
      router.replace(invitationId ? passwordSetupPath(invitationId) : "/dashboard");
    };

    void finish();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="auth-page">
      <section className="auth-card mfa-card" aria-live="polite">
        <p className="erp-eyebrow">Solexa secure sign-in</p>
        <h1 className="auth-title">Verifying your invitation</h1>
        <p className="auth-subtitle">{message}</p>
      </section>
    </main>
  );
}
