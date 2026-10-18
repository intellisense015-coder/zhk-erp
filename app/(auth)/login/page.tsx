"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/primitives/button";
import { AuthInput, PasswordInput } from "../../../components/auth/auth-fields";
import { loginSchema, type LoginFormValues } from "../../../lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const onSubmit = async () => { router.push("/pin"); };

  return <>
    <h1 className="auth-login-title">Welcome back</h1>
    <p className="auth-login-subtitle">Sign in to continue to Solexa.</p>
    <form className="auth-login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthInput label="Email" type="email" autoComplete="email" placeholder="someone@domain.com" error={errors.email?.message} {...register("email")} />
      <PasswordInput label="Password" autoComplete="current-password" placeholder="****************" error={errors.password?.message} {...register("password")} />
      <label className="auth-remember"><input type="checkbox" defaultChecked />Remember this device</label>
      <div className="auth-forgot"><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div>
      <Button type="submit" variant="brand" loading={isSubmitting} className="auth-submit-button">{isSubmitting ? "Signing in..." : "Sign in"}</Button>
    </form>

  </>;
}
