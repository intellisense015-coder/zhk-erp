"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../../components/primitives/button";

export default function PinPage() {
  const router = useRouter();
  const [pin, setPin] = useState(["", "", "", ""]);
  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="auth-link">← Back to sign in</Link><div className="mt-7"><p className="erp-eyebrow">Quick access</p><h1 className="auth-title">Enter your PIN</h1><p className="auth-subtitle">Use your 4-digit workspace PIN to open the Solexa console.</p></div><form className="auth-form" onSubmit={(event) => { event.preventDefault(); router.push("/dashboard"); }}><div className="mb-6 flex justify-between gap-3">{pin.map((value, index) => <input key={index} aria-label={`PIN digit ${index + 1}`} inputMode="numeric" maxLength={1} value={value} onChange={(event) => { const next = [...pin]; next[index] = event.target.value.replace(/\D/g, ""); setPin(next); }} className="h-14 w-full rounded-xl border border-[var(--input-border)] bg-[var(--surface-solid)] text-center text-xl font-bold text-[var(--text-primary)]" />)}</div><Button type="submit">Unlock workspace <span aria-hidden>→</span></Button></form><p className="mt-5 text-center text-xs text-[var(--text-muted)]"><Link href="/forgot-pin" className="auth-link">Forgot your PIN?</Link></p></section></main>;
}
