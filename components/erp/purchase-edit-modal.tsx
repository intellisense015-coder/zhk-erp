"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Calculator, Info, PackageCheck, ShieldCheck, X } from "lucide-react";
import { Button } from "../primitives/button";
import { Field, Modal } from "../primitives/primitives";
import { formatCurrency } from "../../lib/erp-data";
import { purchaseEditSchema, type PurchaseEditFormValues } from "../../lib/validations";

type PurchaseEditModalProps = {
  open: boolean;
  productName: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
  paidAmount: number;
  onClose: () => void;
  onSubmit: (values: PurchaseEditFormValues) => void | Promise<void>;
  serverError?: string | null;
  onDismissServerError?: () => void;
};

export function PurchaseEditModal({ open, productName, purchaseQuantity, purchaseUnitCost, paidAmount, onClose, onSubmit, serverError, onDismissServerError }: PurchaseEditModalProps) {
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<PurchaseEditFormValues>({
    resolver: zodResolver(purchaseEditSchema),
    defaultValues: { quantity: purchaseQuantity, unitCost: purchaseUnitCost },
  });
  const quantity = Number(useWatch({ control, name: "quantity" }) || 0);
  const unitCost = Number(useWatch({ control, name: "unitCost" }) || 0);
  const projectedTotal = quantity * unitCost;
  const projectedOutstanding = projectedTotal - paidAmount;

  useEffect(() => {
    if (open) reset({ quantity: purchaseQuantity, unitCost: purchaseUnitCost });
  }, [open, purchaseQuantity, purchaseUnitCost, reset]);

  return <Modal open={open} title="Edit purchase" description={`Update the quantity or unit cost for ${productName}.`} headerIcon={<PackageCheck size={17} />} className="purchase-edit-modal-card" onClose={onClose}>
    <form onSubmit={handleSubmit(onSubmit)} className="purchase-edit-form">
      <div className="purchase-edit-intro">
        <div className="purchase-edit-intro-icon"><Calculator size={18} /></div>
        <div>
          <span className="purchase-edit-eyebrow">Inventory adjustment</span>
          <strong>{productName}</strong>
          <span>Update the purchase ledger and stock together.</span>
        </div>
      </div>

      {serverError && <div className="purchase-edit-error" role="alert" aria-live="assertive">
        <AlertCircle size={18} aria-hidden="true" />
        <div><strong>Couldn’t save this purchase</strong><p>{serverError}</p></div>
        {onDismissServerError && <button type="button" onClick={onDismissServerError} aria-label="Dismiss error"><X size={15} /></button>}
      </div>}

      <div className="purchase-edit-fields">
        <Field label="Quantity received" type="number" min={1} step={1} {...register("quantity", { valueAsNumber: true })} hint={errors.quantity?.message} />
        <Field label="Unit cost" type="number" min={0.01} step="0.01" {...register("unitCost", { valueAsNumber: true })} hint={errors.unitCost?.message} />
      </div>

      <div className="purchase-edit-summary">
        <div className="purchase-edit-summary-heading"><span><Calculator size={14} />Projected totals</span><strong>{quantity > 0 && unitCost > 0 ? formatCurrency(projectedTotal) : "—"}</strong></div>
        <div className="purchase-edit-summary-grid">
          <div><span>Already paid</span><strong>{formatCurrency(paidAmount)}</strong></div>
          <div><span>Remaining balance</span><strong className={projectedOutstanding < 0 ? "is-invalid" : ""}>{projectedTotal > 0 ? formatCurrency(projectedOutstanding) : "—"}</strong></div>
        </div>
      </div>

      <div className="purchase-edit-protection"><ShieldCheck size={16} aria-hidden="true" /><p><strong>Protected ledger fields</strong><span>Supplier, payment history, invoice number, funding source, and recorded date stay unchanged.</span></p><Info size={15} aria-hidden="true" /></div>

      <div className="primitive-dialog-actions purchase-edit-actions"><Button type="button" variant="secondary" className="cancel-button" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save changes"}</Button></div>
    </form>
  </Modal>;
}
