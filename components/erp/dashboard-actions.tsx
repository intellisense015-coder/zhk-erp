"use client";

import { Plus, Truck } from "lucide-react";
import { useState } from "react";
import { Button } from "../primitives/button";
import { ProductFormModal } from "./product-form-modal";
import { PurchaseFormModal } from "./purchase-form-modal";
import { useErpStore } from "../../lib/erp-store";
import type { ProductFormValues, PurchaseFormValues } from "../../lib/validations";

export function DashboardActions() {
  const { addProduct, addPurchase } = useErpStore();
  const [productOpen, setProductOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const closeProduct = () => setProductOpen(false);
  const closePurchase = () => setPurchaseOpen(false);
  const saveProduct = (values: ProductFormValues) => { addProduct(values); closeProduct(); };
  const savePurchase = (values: PurchaseFormValues) => { const result = addPurchase(values); if (result.ok) closePurchase(); };
  return <><div className="flex gap-2"><Button variant="secondary" onClick={() => setPurchaseOpen(true)}><Truck size={15} />Add stock</Button><Button onClick={() => setProductOpen(true)}><Plus size={15} />Add product</Button></div><ProductFormModal open={productOpen} onClose={closeProduct} onSubmit={saveProduct} /><PurchaseFormModal open={purchaseOpen} onClose={closePurchase} onSubmit={savePurchase} /></>;
}
