"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/primitives/button";
import { AuthInput, PasswordInput } from "../../../components/auth/auth-fields";
import { loginSchema, type LoginFormValues } from "../../../lib/validations";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("reset") === "success") {
      const timer = window.setTimeout(() => setNotice("Your password was reset successfully. Sign in with your new password."), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setAuthError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthError("Authentication is not configured for this environment.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError("Unable to sign in with those details.");
      return;
    }

    const nextPath = safeNextPath(new URL(window.location.href).searchParams.get("next"));
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance) {
      setAuthError("We could not verify your authenticator status. Please try again.");
      return;
    }

    // Password authentication only establishes AAL1. The MFA page decides
    // whether this account needs a new QR enrollment or an existing-factor
    // challenge before any ERP route can be opened.
    if (assurance.currentLevel !== "aal2") {
      router.replace(`/mfa?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    router.replace(nextPath);
  };

  return <>
    <h1 className="auth-login-title">Welcome back</h1>
    <p className="auth-login-subtitle">Sign in to continue to Solexa.</p>
    <form className="auth-login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthInput label="Email" type="email" autoComplete="email" placeholder="someone@domain.com" error={errors.email?.message} {...register("email")} />
      <PasswordInput label="Password" autoComplete="current-password" placeholder="****************" error={errors.password?.message} {...register("password")} />
      <label className="auth-remember"><input type="checkbox" defaultChecked />Remember this device</label>
      <div className="auth-forgot"><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div>
      {notice && <p className="settings-success" role="status">{notice}</p>}
      {authError && <p className="auth-field-error" role="alert">{authError}</p>}
      <Button type="submit" variant="brand" loading={isSubmitting} className="auth-submit-button">{isSubmitting ? "Signing in..." : "Sign in"}</Button>
    </form>

  </>;
}
