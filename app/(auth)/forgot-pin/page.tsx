"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Compatibility route for old PIN-recovery bookmarks. */
export default function ForgotPinPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
