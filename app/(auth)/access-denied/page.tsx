"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/primitives/button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AccessDeniedPage() {
  const router = useRouter();

  const signOut = async () => {
    await createSupabaseBrowserClient()?.auth.signOut();
    window.localStorage.removeItem("solexa-workspace-id");
    router.replace("/login");
  };

  return <main className="auth-page"><section className="auth-card"><p className="erp-eyebrow">Solexa workspace access</p><h1 className="auth-title">No ERP features assigned</h1><p className="auth-subtitle">Your account is active, but the workspace owner has not granted access to an ERP feature yet.</p><div className="mt-7 flex flex-col gap-3"><Button type="button" variant="brand" onClick={() => void signOut()}>Sign out</Button><Link href="/login" className="auth-link text-center">Return to sign in</Link></div></section></main>;
}
