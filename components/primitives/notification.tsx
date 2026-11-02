"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export type NotificationVariant = "success" | "error";

type NotificationProps = {
  message?: string | null;
  variant: NotificationVariant;
  onDismiss?: () => void;
  duration?: number;
};

export function Notification({ message, variant, onDismiss, duration = 5000 }: NotificationProps) {
  useEffect(() => {
    if (!message || !onDismiss) return undefined;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onDismiss]);

  if (!message) return null;
  const Icon = variant === "success" ? CheckCircle2 : XCircle;

  const notification = <div className={`solexa-notification solexa-notification-${variant}`} role={variant === "error" ? "alert" : "status"} aria-live={variant === "error" ? "assertive" : "polite"}>
    <Icon size={17} aria-hidden="true" />
    <span>{message}</span>
    {onDismiss && <button type="button" className="solexa-notification-dismiss" aria-label="Dismiss notification" onClick={onDismiss}><X size={15} /></button>}
  </div>;

  return typeof document === "undefined" ? null : createPortal(notification, document.body);
}
