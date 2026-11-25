import assert from "node:assert/strict";
import test from "node:test";
import { getCapitalSummary, getTransactionGrossProfit, roundMoney, type CapitalEntry, type SupplierPayment, type Transaction } from "../lib/erp-data.ts";

const baseEntry = (overrides: Partial<CapitalEntry> = {}): CapitalEntry => ({
  id: "entry-1",
  capitalId: "capital-1",
  type: "contribution",
  amount: 1_000_000,
  date: "2026-11-23",
  month: "2026-11",
  createdAt: "2026-11-23T00:00:00.000Z",
  ...overrides,
});

const purchase = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "purchase-1",
  type: "purchase",
  name: "Stock",
  party: "Supplier",
  quantity: 1,
  amount: 200_000,
  time: "Just now",
  date: "2026-11-23",
  month: "2026-11",
  source: "supplier",
  capitalId: "capital-1",
  fundingSource: "capital",
  ...overrides,
});

const payment = (overrides: Partial<SupplierPayment> = {}): SupplierPayment => ({
  id: "payment-1",
  supplierId: "supplier-1",
  amount: 50_000,
  date: "2026-11-23",
  time: "Just now",
  capitalId: "capital-1",
  ...overrides,
});

test("capital available balance deducts full capital-backed purchase cost", () => {
  const entries = [baseEntry(), baseEntry({ id: "entry-2", type: "withdrawal", amount: 100_000 })];
  const summary = getCapitalSummary("capital-1", entries, [purchase()], []);

  assert.deepEqual(summary, { contributed: 1_000_000, withdrawn: 100_000, used: 200_000, available: 700_000 });
});

test("linked supplier settlement is not deducted twice", () => {
  const summary = getCapitalSummary("capital-1", [baseEntry()], [purchase()], [payment({ purchaseTransactionId: "purchase-1" })]);

  assert.equal(summary.used, 200_000);
  assert.equal(summary.available, 800_000);
});

test("standalone capital-funded supplier payment reduces available capital", () => {
  const summary = getCapitalSummary("capital-1", [baseEntry()], [], [payment()]);

  assert.equal(summary.used, 50_000);
  assert.equal(summary.available, 950_000);
});

test("profit is calculated from sale line items, not purchase or transfer records", () => {
  const sale: Transaction = {
    id: "sale-1",
    type: "sale",
    name: "Phone",
    party: "Customer",
    quantity: 2,
    amount: 2_000,
    profit: 999_999,
    time: "Just now",
    date: "2026-11-23",
    month: "2026-11",
    items: [
      { productId: "product-1", name: "Phone", sku: "PHONE-1", quantity: 2, unitSellingPrice: 1_000, unitCost: 700, discount: 100, amount: 1_900, profit: 500 },
    ],
  };

  assert.equal(getTransactionGrossProfit(sale), 500);
  assert.equal(getTransactionGrossProfit(purchase()), 0);
});

test("money rounding is deterministic to two decimal places", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(1_234.567), 1_234.57);
});
