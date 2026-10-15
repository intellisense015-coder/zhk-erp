"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/primitives/button";
import { Field } from "../../../components/primitives/primitives";
import { loginSchema, type LoginFormValues } from "../../../lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const onSubmit = async () => { router.push("/2fa"); };

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-logo"><div className="auth-logo-mark">✦</div><div><strong>solexa</strong><div className="text-[9px] font-bold uppercase tracking-[.2em] text-[var(--text-muted)]">by intellisense</div></div></div>
    <h1 className="auth-title">Welcome back</h1>
    <p className="auth-subtitle">Sign in to manage your stock, trading activity, and business performance.</p>
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Work email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} hint={errors.email?.message} />
      <Field label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" {...register("password")} hint={errors.password?.message} />
      <div className="mb-4 flex justify-end"><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div>
      <Button type="submit" loading={isSubmitting}>Continue <span aria-hidden>→</span></Button>
    </form>
    <p className="mt-5 text-center text-xs text-[var(--text-muted)]">Prefer quick access? <Link href="/pin" className="auth-link">Use PIN access</Link></p>
  </section></main>;
}
