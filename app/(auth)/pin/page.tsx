"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

/** Compatibility route for old bookmarks; the authenticator flow now lives at /mfa. */
export default function PinPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const redirectFromLegacyPinRoute = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      router.replace(data.session ? "/mfa" : "/login");
    };

    void redirectFromLegacyPinRoute();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-live="polite">
        <p className="erp-eyebrow">Secure access</p>
        <h1 className="auth-title">Opening your workspace…</h1>
        <p className="auth-subtitle">Your Supabase session is verifying access.</p>
      </section>
    </main>
  );
}
