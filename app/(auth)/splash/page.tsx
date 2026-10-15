"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SplashPage() {
  const router = useRouter();
  useEffect(() => { const timer = window.setTimeout(() => router.replace("/login"), 1800); return () => window.clearTimeout(timer); }, [router]);

  return <main className="solexa-splash-page"><div className="solexa-splash-content"><Image src="/solexa-logo.jpeg" alt="Solexa" width={72} height={72} priority className="solexa-splash-logo" /><div className="splash-brand">solexa</div><div className="splash-sub">by intellisense</div><p>Inventory clarity for every gadget trade.</p><div className="solexa-splash-loader" aria-label="Loading Solexa" /></div></main>;
}
