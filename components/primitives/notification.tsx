"use client";

import { sileo } from "sileo";
import { useEffect, useRef } from "react";

export type NotificationVariant = "success" | "error";

type NotificationProps = {
  message?: string | null;
  variant: NotificationVariant;
  onDismiss?: () => void;
  duration?: number;
};

export function Notification({ message, variant, onDismiss, duration = 5000 }: NotificationProps) {
  const lastToastRef = useRef<string | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      lastToastRef.current = null;
      return undefined;
    }

    const toastKey = `${variant}:${message}`;
    if (lastToastRef.current === toastKey) return undefined;
    lastToastRef.current = toastKey;

    const toastId = sileo[variant]({
      title: variant === "error" ? "Error" : "Success",
      description: message,
      duration,
    });

    const timer = window.setTimeout(() => onDismissRef.current?.(), duration);
    return () => {
      window.clearTimeout(timer);
      sileo.dismiss(toastId);
    };
  }, [duration, message, variant]);

  return null;
}
