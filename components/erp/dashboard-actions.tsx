"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../primitives/button";
import { ProductFormModal } from "./product-form-modal";
import { useErpStore } from "../../lib/erp-store";
import type { ProductFormValues } from "../../lib/validations";

export function DashboardActions() {
  const { addProduct } = useErpStore();
  const [productOpen, setProductOpen] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const closeProduct = () => { setProductOpen(false); setProductError(null); };
  const saveProduct = async (values: ProductFormValues) => { const result = await addProduct(values); if (result.ok) closeProduct(); else setProductError(result.message); return result; };
  return <><div className="flex gap-2"><Button variant="brand" onClick={() => { setProductError(null); setProductOpen(true); }}><Plus size={15} />Add product</Button></div><ProductFormModal open={productOpen} onClose={closeProduct} onSubmit={saveProduct} serverError={productError} /></>;
}
