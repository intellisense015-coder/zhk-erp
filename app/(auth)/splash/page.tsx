"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "motion/react";

export default function SplashPage() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/login"), 2800);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="splash-screen relative min-h-screen overflow-hidden">
      <div className="splash-screen__background" aria-hidden="true" />
      <motion.div
        className="splash-screen__glow"
        aria-hidden="true"
        animate={{ opacity: [0.22, 0.42, 0.22], scale: [1, 1.13, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.section
        initial={{ opacity: 0, x: 38, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 1.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="splash-screen__brand"
      >
        <motion.h1
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        >
          Solexa
        </motion.h1>
        <p>By Intellisense.cloud</p>
        <div className="splash-screen__progress" aria-hidden="true">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2.65, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </motion.section>
    </main>
  );
}
