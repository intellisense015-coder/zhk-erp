"use client";

import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ChangeEventHandler, type ClipboardEventHandler, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "./dialog";

export { Button } from "./button";
export { ConfirmDialog, Dialog, Modal, cn } from "./dialog";
export type { ModalProps } from "./dialog";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; textOnly?: boolean; numberOnly?: boolean };

export function Field({ label, hint, className = "", textOnly = false, numberOnly = false, onChange, onPaste, type, ...props }: FieldProps) {
  const inferredTextOnly = textOnly || ["Business name", "Customer name", "Supplier name", "New vendor name"].includes(label);
  const inferredNumberOnly = numberOnly || /contact/i.test(label);
  const isNumberInput = inferredNumberOnly || type === "number";
  const sanitize = (value: string) => {
    if (inferredTextOnly) return value.replace(/\d/g, "");
    if (type === "number") return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    if (inferredNumberOnly) return value.replace(/[^\d+().\s-]/g, "");
    return value;
  };
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = sanitize(event.currentTarget.value);
    if (next !== event.currentTarget.value) event.currentTarget.value = next;
    onChange?.(event);
  };
  const handlePaste: ClipboardEventHandler<HTMLInputElement> = (event) => {
    const pasted = event.clipboardData.getData("text");
    if ((inferredTextOnly && /\d/.test(pasted)) || (isNumberInput && type === "number" && /[^\d.]/.test(pasted)) || (inferredNumberOnly && type !== "number" && /[^\d+().\s-]/.test(pasted))) event.preventDefault();
    onPaste?.(event);
  };
  return <label className={cn("block", className)}>{label ? <span className="mb-2 block text-[10px] font-semibold text-[var(--text-primary)]">{label}</span> : null}<input className="floating-input h-11 w-full rounded-[14px] px-4 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" type={type} onChange={handleChange} onPaste={handlePaste} {...props} />{hint ? <span className="mt-1.5 block text-[10px] text-[var(--error)]">{hint}</span> : null}</label>;
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; searchable?: boolean; searchPlaceholder?: string; children: ReactNode };
type OptionProps = { value?: string | number; children?: ReactNode };

export function SelectField({ label, hint, className = "", children, searchable = false, searchPlaceholder = "Search...", ...props }: SelectFieldProps) {
  const { value, defaultValue, onChange, name, disabled, "aria-label": ariaLabel } = props;
  const options = Children.toArray(children).filter(isValidElement).map((child) => { const option = child.props as OptionProps; return { value: String(option.value ?? ""), label: option.children }; });
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedValue = value !== undefined ? String(value) : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const visibleOptions = searchable ? options.filter((option) => String(option.label).toLowerCase().includes(query.toLowerCase())) : options;

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height || Math.min(256, visibleOptions.length * 44 + (searchable ? 64 : 16));
    const opensAbove = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top - menuHeight - 8 >= 16;
    setPosition({ top: opensAbove ? rect.top - menuHeight - 8 : rect.bottom + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - rect.width - 16)), width: rect.width });
  };

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, options.length, visibleOptions.length]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event: MouseEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { window.removeEventListener("mousedown", closeOnOutside); window.removeEventListener("keydown", closeOnEscape); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open]);

  const selectOption = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.({ target: { value: nextValue, name: name || "" } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const menu = open && typeof document !== "undefined" ? createPortal(<div ref={menuRef} className="custom-select-menu" style={{ top: position.top, left: position.left, width: position.width }} role="listbox" aria-label={ariaLabel || label}>{searchable && <label className="custom-select-search"><Search size={13} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></label>}{visibleOptions.map((option) => <button type="button" role="option" aria-selected={selectedValue === option.value} className={cn("custom-select-option", selectedValue === option.value && "is-selected")} key={option.value} onClick={() => selectOption(option.value)}>{option.label}<span className="custom-select-check">{selectedValue === option.value ? <Check size={13} /> : null}</span></button>)}{!visibleOptions.length && <p className="custom-select-empty">No options available</p>}</div>, document.body) : null;

  return <label className="modal-field"><span className="modal-field-label">{label}</span><button ref={triggerRef} type="button" className={cn("custom-select-trigger", className, hint && "has-error")} onClick={() => { setOpen((current) => !current); setQuery(""); requestAnimationFrame(updatePosition); }} aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel || label} disabled={disabled}>{selected?.label || options[0]?.label || "Select an option"}<ChevronDown size={14} className={cn("custom-select-chevron", open && "is-open")} /></button>{menu}<span className={hint ? "modal-field-hint" : "modal-field-hint modal-field-hint-empty"}>{hint || " "}</span></label>;
}

export function DateField({ label, hint, ...props }: FieldProps) {
  return <Field label={label} hint={hint} type="date" {...props} />;
}

export function TimeField({ label, hint, ...props }: FieldProps) {
  return <Field label={label} hint={hint} type="time" {...props} />;
}

