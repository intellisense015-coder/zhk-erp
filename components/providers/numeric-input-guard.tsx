"use client";

import { useEffect } from "react";

/** Prevent accidental wheel-driven changes while a numeric field is focused. */
export function NumericInputGuard() {
  useEffect(() => {
    const preventWheelChange = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "number" || document.activeElement !== target) return;
      event.preventDefault();
    };
    document.addEventListener("wheel", preventWheelChange, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", preventWheelChange, true);
  }, []);

  return null;
}
