"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/primitives/button";
import { twoFactorSchema, type TwoFactorFormValues } from "../../../lib/validations";

export default function TwoFactorPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TwoFactorFormValues>({ resolver: zodResolver(twoFactorSchema), defaultValues: { code: "" } });
  const onSubmit = async () => { router.push("/dashboard"); };

  return <main className="auth-page"><section className="auth-card auth-card-compact">
    <Link href="/login" className="auth-link">← Back to sign in</Link>
    <div className="auth-step-mark">2FA</div>
    <h1 className="auth-title">Verify your sign-in</h1>
    <p className="auth-subtitle">Enter the 6-digit verification code sent to your administrator email.</p>
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <label className="block"><span className="mb-2 block text-[10px] font-semibold text-[var(--text-primary)]">Verification code</span><input {...register("code")} className="auth-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="6-digit verification code" />{errors.code?.message && <span className="mt-1.5 block text-[10px] text-[var(--error)]">{errors.code.message}</span>}</label>
      <Button type="submit" loading={isSubmitting}>Verify and continue <span aria-hidden>→</span></Button>
    </form>
    <p className="mt-5 text-center text-xs text-[var(--text-muted)]">Didn&apos;t receive it? <button type="button" className="auth-link bg-transparent p-0" onClick={() => undefined}>Resend code</button></p>
  </section></main>;
}
