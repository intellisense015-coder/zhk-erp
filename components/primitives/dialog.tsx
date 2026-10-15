"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footerActions?: ReactNode;
  wide?: boolean;
  noScroll?: boolean;
  transparent?: boolean;
  className?: string;
};

export function Modal({ open = true, onClose, title = "Dialog", description, children, footerActions, wide = false, noScroll = false, transparent = false, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="modal-overlay primitive-dialog-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}><section role="dialog" aria-modal="true" aria-label={title || "Dialog"} className={cn("modal-card primitive-dialog", transparent && "invoice-modal-card", noScroll ? "modal-no-scroll" : "", wide ? "modal-wide" : "", className)}><header className="modal-header primitive-dialog-header"><div><h2 className="modal-title">{title}</h2>{description && <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">{description}</p>}</div><button type="button" onClick={onClose} className="modal-close-btn primitive-dialog-close" aria-label="Close dialog"><X size={16} /></button></header><div className={cn("modal-body", title.startsWith("Filter") && "filter-modal-body")}>{children}</div>{footerActions && <footer className="modal-footer">{footerActions}</footer>}</section></div>, document.body);
}

export function Dialog(props: ModalProps) { return <Modal {...props} />; }

export function ConfirmDialog({ open = true, onClose, onConfirm, title = "Are you sure?", description, confirmLabel = "Confirm" }: Omit<ModalProps, "children"> & { onConfirm: () => void; confirmLabel?: string }) {
  return <Modal open={open} onClose={onClose} title={title} description={description} footerActions={<><button type="button" className="primitive-btn primitive-btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="primitive-btn primitive-btn-danger" onClick={onConfirm}>{confirmLabel}</button></>}><p className="text-[10px] leading-5 text-[var(--text-muted)]">This action can be changed later by an administrator.</p></Modal>;
}
