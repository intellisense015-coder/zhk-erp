"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ModalSkeleton } from "./skeleton";

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  headerIcon?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
  wide?: boolean;
  noScroll?: boolean;
  transparent?: boolean;
  loading?: boolean;
  className?: string;
};

export function Modal({ open = true, onClose, title = "Dialog", description, headerIcon, children, footerActions, wide = false, noScroll = false, transparent = false, loading = false, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); };
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <motion.div className="modal-overlay primitive-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}><motion.section role="dialog" aria-modal="true" aria-label={title || "Dialog"} className={cn("modal-card primitive-dialog", transparent && "invoice-modal-card", noScroll ? "modal-no-scroll" : "", wide ? "modal-wide" : "", className)} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}><header className="modal-header primitive-dialog-header"><div className={cn("modal-heading", Boolean(headerIcon) && "modal-heading-with-icon")}>{headerIcon && <span className="modal-header-icon" aria-hidden="true">{headerIcon}</span>}<div className="modal-heading-copy"><h2 className="modal-title">{title}</h2>{description && <p className="modal-description">{description}</p>}</div></div><button type="button" onClick={onClose} className="modal-close-btn primitive-dialog-close" aria-label="Close dialog"><X size={16} /></button></header><div className={cn("modal-body", title.startsWith("Filter") && "filter-modal-body")}>{loading ? <ModalSkeleton /> : children}</div>{!loading && footerActions && <footer className="modal-footer">{footerActions}</footer>}</motion.section></motion.div>}</AnimatePresence>, document.body);
}

export function Dialog(props: ModalProps) { return <Modal {...props} />; }

export function ConfirmDialog({ open = true, onClose, onConfirm, title = "Are you sure?", description, confirmLabel = "Confirm" }: Omit<ModalProps, "children"> & { onConfirm: () => void; confirmLabel?: string }) {
  return <Modal open={open} onClose={onClose} title={title} description={description ?? "This action cannot be undone."} headerIcon={<AlertTriangle size={20} strokeWidth={2.5} />} className="confirm-dialog" footerActions={<><button type="button" className="primitive-btn primitive-btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="primitive-btn primitive-btn-danger" onClick={onConfirm}>{confirmLabel}</button></>}>{null}</Modal>;
}
