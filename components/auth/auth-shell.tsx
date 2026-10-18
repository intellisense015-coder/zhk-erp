"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

export function AuthShell({ children, hero = "login", centered = false }: { children: ReactNode; hero?: "login" | "pin"; centered?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/splash" || pathname === "/pin" || pathname === "/onboarding") return children;

  return <main className="auth-shell-page"><div className={`auth-shell-layout ${centered ? "is-centered" : ""}`}>
    {!centered && <motion.aside initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .9, ease: [0.16, 1, 0.3, 1] }} className="auth-hero-panel">
      <Image src="/splash-back-dark.jpeg" alt={hero === "pin" ? "Solexa workspace access" : "Solexa technology workspace"} fill priority sizes="45vw" className="auth-hero-image" />

      <div className="auth-hero-badge"><Image src="/solexa-logo.png" alt="Solexa" width={48} height={48} className="auth-hero-logo" /><span><b>Solexa</b><small>by intellisense.cloud</small></span></div>
      <div className="auth-hero-content"><p>Inventory clarity for every gadget trade.</p><div className="auth-hero-rule" /><span className="auth-hero-caption">by intellisense.cloud</span></div>
    </motion.aside>}
    <section className={`auth-form-pane ${centered ? "is-centered" : ""}`}>
      <ThemeToggle />
      <motion.div key={pathname} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }} className="auth-form-content">{children}</motion.div>
    </section>
  </div></main>;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("solexa-theme-change", onChange);
      return () => window.removeEventListener("solexa-theme-change", onChange);
    },
    () => document.documentElement.getAttribute("data-theme") === "dark",
    () => false,
  );
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    window.localStorage.setItem("solexa-theme", next ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("solexa-theme-change", { detail: next ? "dark" : "light" }));
  };
  return <button type="button" className="auth-theme-toggle" onClick={toggle} aria-label={`Use ${isDark ? "light" : "dark"} theme`}><span className={!isDark ? "is-active" : ""}><Sun size={13} />Light</span><span className={isDark ? "is-active" : ""}><Moon size={13} />Dark</span></button>;
}
