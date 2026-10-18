"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

const PIN_LENGTH = 6;

export default function PinPage() {
  const router = useRouter();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [heroSource, setHeroSource] = useState("/auth/loomledger-pin-hero.png");

  const toggleTheme = (mode: "light" | "dark") => {
    setTheme(mode);
    if (mode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const clear = useCallback(() => {
    setDigits(Array(PIN_LENGTH).fill(""));
    window.setTimeout(() => refs.current[0]?.focus(), 50);
  }, []);

  const handleChange = (index: number, value: string) => {
    setError("");
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = sanitized;
    setDigits(nextDigits);
    if (sanitized && index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pastedData) return;
    const nextDigits = [...digits];
    for (let index = 0; index < pastedData.length; index += 1) nextDigits[index] = pastedData[index];
    setDigits(nextDigits);
    refs.current[Math.min(pastedData.length, PIN_LENGTH - 1)]?.focus();
  };

  useEffect(() => {
    if (digits.join("").length !== PIN_LENGTH) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      window.localStorage.setItem("solexa-pin-passed", "true");
      const storedProfile = window.localStorage.getItem("solexa-business-profile");
      router.replace(storedProfile ? "/dashboard" : "/onboarding");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [digits, router]);

  return (
    <main className="pin-reference-page">
      <div className="pin-reference-layout">
        <motion.section initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="pin-reference-hero">
          <div className="pin-reference-hero-art">
            <Image src={heroSource} alt="Solexa Assistant" fill priority sizes="50vw" className="pin-reference-hero-image" onError={() => { if (heroSource !== "/splash-back-dark.jpeg") setHeroSource("/splash-back-dark.jpeg"); }} />
          </div>
          <div className="pin-reference-brand">
            <Image src="/solexa-logo.png" alt="Solexa" width={40} height={40} className="pin-reference-brand-logo" />
            <div><b>Solexa</b><small>By Intellisense</small></div>
          </div>
        </motion.section>

        <section className="pin-reference-form-pane">
          <div className="pin-reference-theme-toggle">
            <button type="button" onClick={() => toggleTheme("light")} className={theme === "light" ? "is-active" : ""}><Sun size={12} /><span>Light</span></button>
            <button type="button" onClick={() => toggleTheme("dark")} className={theme === "dark" ? "is-active" : ""}><Moon size={12} /><span>Dark</span></button>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="pin-reference-form">
            <h1>Enter your PIN</h1>
            <p>Use your 6-digit security PIN.</p>
            <div className="pin-reference-inputs">
              {digits.map((digit, index) => (
                <input key={index} ref={(element) => { refs.current[index] = element; }} type="text" inputMode="numeric" pattern="\\d*" maxLength={1} value={digit} disabled={loading} onChange={(event) => handleChange(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { clear(); return; } if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus(); }} onPaste={handlePaste} aria-label={`Digit ${index + 1}`} className={`pin-reference-input${error ? " has-error" : ""}${loading ? " is-loading" : ""}`} />
              ))}
            </div>
            <div className="pin-reference-feedback" aria-live="polite">{error ? <span>{error}</span> : loading ? <span className="is-loading-message">Verifying securely...</span> : null}</div>
            <div className="pin-reference-links"><Link href="/forgot-pin">Forgot PIN?</Link><span>•</span><button type="button" onClick={() => router.push("/login")}>Back to sign in</button></div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
