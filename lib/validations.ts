import { z } from "zod";

const positiveNumber = z.number().positive("Must be greater than 0");
const nonNegativeNumber = z.number().min(0, "Cannot be negative");
const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const productSchema = z.object({
  name: requiredText("Product name"),
  sku: requiredText("SKU"),
  category: requiredText("Category"),
  vendorName: requiredText("Vendor"),
  costPrice: positiveNumber,
  sellingPrice: positiveNumber,
  inStockQuantity: nonNegativeNumber,
  reorderLevel: nonNegativeNumber,
});

export const purchaseSchema = z.object({
  supplierId: z.string().optional(),
  vendorName: requiredText("Supplier name"),
  supplierContactNumber: z.string().trim().regex(/^[+()\d\s-]{7,}$/, "Enter a valid contact number"),
  supplierCompany: z.string().trim().optional(),
  productId: requiredText("Product"),
  quantity: positiveNumber,
  unitCost: positiveNumber,
  paidAmount: nonNegativeNumber,
});

export const saleLineItemSchema = z.object({
  productId: requiredText("Product"),
  quantity: positiveNumber,
  unitSellingPrice: positiveNumber,
  discount: nonNegativeNumber,
});

export const saleSchema = z.object({
  customerId: z.string().optional(),
  customerName: requiredText("Customer name"),
  customerContactNumber: z.string().trim().regex(/^[+()\d\s-]{7,}$/, "Enter a valid contact number"),
  customerCode: z.string().trim().regex(/^[A-Za-z0-9_-]{3,}$/, "Customer code is generated automatically"),
  items: z.array(saleLineItemSchema).min(1, "Add at least one product"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid work email"),
  password: z.string().min(1, "Password is required"),
});

export const twoFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
export type SaleFormValues = z.infer<typeof saleSchema>;
export type SaleLineItemFormValues = z.infer<typeof saleLineItemSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;
