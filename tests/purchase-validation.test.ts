import assert from "node:assert/strict";
import test from "node:test";
import { purchaseSchema } from "../lib/validations.ts";

const basePurchase = {
  supplierId: "supplier-1",
  vendorName: "Supplier",
  supplierContactNumber: "03001234567",
  supplierCompany: "",
  productId: "product-1",
  quantity: 2,
  unitCost: 100,
  paidAmount: 0,
};

test("supplier-credit stock can be recorded without a capital account", () => {
  const result = purchaseSchema.safeParse({ ...basePurchase, fundingSource: "supplier-credit", capitalId: "" });
  assert.equal(result.success, true);
});

test("capital-funded stock still requires a capital account", () => {
  const result = purchaseSchema.safeParse({ ...basePurchase, fundingSource: "capital", capitalId: "" });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === "capitalId"));
});
