"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/primitives/button";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { passwordSetupPath, safeInvitationId } from "../../../../lib/supabase/access";

function cleanError(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "").trim() || "This invitation could not be accepted.";
}

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Checking your invitation…");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const accept = async () => {
      const invitationId = safeInvitationId(new URL(window.location.href).searchParams.get("invitation"));
      if (!invitationId) {
        setError("This invitation link is incomplete.");
        setLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Authentication is not configured for this environment.");
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) {
        router.replace(`/login?next=${encodeURIComponent(`/invite/accept?invitation=${invitationId}`)}`);
        return;
      }

      // The invitation callback creates a temporary Auth session. Password
      // setup must be completed before MFA or workspace membership can be
      // granted, even if a user navigates here directly.
      if (userData.user.user_metadata?.password_initialized !== true) {
        router.replace(passwordSetupPath(invitationId));
        return;
      }

      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assuranceError || !assurance) {
        setError("We could not verify your Microsoft Authenticator status.");
        setLoading(false);
        return;
      }
      if (assurance.currentLevel !== "aal2") {
        router.replace(`/mfa?next=${encodeURIComponent(`/invite/accept?invitation=${invitationId}`)}`);
        return;
      }

      setMessage("Activating your workspace access securely…");
      const { data: workspaceId, error: acceptError } = await supabase.rpc("accept_workspace_invitation", {
        target_invitation_id: invitationId,
      });
      if (!active) return;
      if (acceptError || typeof workspaceId !== "string") {
        setError(cleanError(acceptError?.message ?? "This invitation could not be accepted."));
        setLoading(false);
        return;
      }

      // The invitation marker is only needed until the first acceptance. It
      // prevents a direct dashboard visit from bypassing password setup, but
      // must not force an already accepted member back through invitation flow
      // on their next login.
      await supabase.auth.updateUser({
        data: {
          workspace_invitation_id: null,
          password_initialized: true,
        },
      });
      window.localStorage.setItem("solexa-workspace-id", workspaceId);
      router.replace("/dashboard");
    };

    void accept();
    return () => { active = false; };
  }, [router]);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="auth-page">
      <section className="auth-card mfa-card" aria-live="polite">
        <p className="erp-eyebrow">Solexa workspace access</p>
        <h1 className="auth-title">Join your workspace</h1>
        {error ? <p className="auth-field-error" role="alert">{error}</p> : <p className="auth-subtitle">{message}</p>}
        {!loading && error && <Button type="button" variant="brand" onClick={() => router.replace("/login")}>Return to sign in</Button>}
        <button type="button" className="mfa-signout" onClick={() => void signOut()}>Sign out</button>
      </section>
    </main>
  );
}
