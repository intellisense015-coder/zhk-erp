"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/splash") return children;

  return <div className="auth-shell-layout">
      <aside className="auth-hero-panel">
        <Image src="/splash-back-dark.jpeg" alt="Solexa technology workspace" fill priority sizes="50vw" className="auth-hero-image" />
        <div className="auth-hero-overlay" />
        <div className="auth-hero-content"><div className="auth-hero-brand"><Image src="/solexa-logo.jpeg" alt="Solexa" width={44} height={44} className="auth-hero-logo" /><span>solexa</span></div><p>Inventory clarity for every gadget trade.</p><div className="auth-hero-rule" /><span className="auth-hero-caption">by intellisense</span></div>
      </aside>
      <div className="auth-form-pane">{children}</div>
    </div>;
}
