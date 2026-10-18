"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { cn } from "../primitives/dialog";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  success?: boolean;
};

export function AuthInput({ label, error, success, className, ...props }: AuthInputProps) {
  return <label className="auth-field-group">
    <span className="auth-field-label">{label}</span>
    <span className="auth-field-wrap">
      <Mail size={16} aria-hidden="true" className="auth-field-leading" />
      <input {...props} className={cn("auth-field-input", className)} data-error={Boolean(error)} data-success={Boolean(success && !error)} />
      {(error || success) && <span className={cn("auth-field-status", error ? "is-error" : "is-success")} aria-hidden="true">{error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}</span>}
    </span>
    {error && <span className="auth-field-error">{error}</span>}
  </label>;
}

export function PasswordInput({ label, error, className, ...props }: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field-group">
    <span className="auth-field-label">{label}</span>
    <span className="auth-field-wrap">
      <LockKeyhole size={16} aria-hidden="true" className="auth-field-leading" />
      <input {...props} type={visible ? "text" : "password"} className={cn("auth-field-input", className)} data-error={Boolean(error)} />
      <button type="button" className="auth-field-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
    </span>
    {error && <span className="auth-field-error">{error}</span>}
  </label>;
}
