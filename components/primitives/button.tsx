"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "./dialog";

type ButtonProps = Omit<ComponentProps<typeof motion.button>, "ref" | "children"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "brand" | "soft";
  loading?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "soft", loading = false, disabled, className, children, ...props }, ref) {
  const variants = {
    primary: "primitive-btn brand-button",
    brand: "primitive-btn brand-button",
    secondary: "primitive-btn soft-button",
    soft: "primitive-btn soft-button",
    ghost: "primitive-btn primitive-btn-ghost",
    danger: "primitive-btn primitive-btn-danger",
  };
  return <motion.button ref={ref} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ y: 0, scale: 0.985 }} transition={{ duration: 0.55 }} className={cn(variants[variant], className)} disabled={disabled || loading} {...props}>{loading && <LoaderCircle size={16} className="animate-spin" />}{children}</motion.button>;
});
