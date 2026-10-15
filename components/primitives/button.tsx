"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./dialog";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "brand";
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = "primary", loading = false, disabled, className, children, ...props }: ButtonProps) {
  const variants = {
    primary: "primitive-btn primitive-btn-primary",
    brand: "primitive-btn primitive-btn-primary",
    secondary: "primitive-btn primitive-btn-secondary",
    ghost: "primitive-btn primitive-btn-ghost",
    danger: "primitive-btn primitive-btn-danger",
  };
  return <button className={cn(variants[variant], className)} disabled={disabled || loading} {...props}>{loading && <LoaderCircle size={15} className="animate-spin" />}{children}</button>;
}
