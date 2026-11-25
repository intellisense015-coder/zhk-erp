import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = async (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("capital accounting migration contains the server-side purchase guardrail", async () => {
  const sql = await migration("20261123130000_enforce_capital_purchase_accounting.sql");
  assert.match(sql, /create or replace function public\.capital_available/i);
  assert.match(sql, /Every supplier stock purchase must use a capital account/i);
  assert.match(sql, /insufficient capital/i);
  assert.match(sql, /create trigger transactions_enforce_capital_purchase_balance/i);
});

test("opening-stock product RPC is atomic and executable by authenticated users", async () => {
  const sql = await migration("20261123150000_create_product_with_capital.sql");
  assert.match(sql, /create or replace function public\.create_product_with_capital/i);
  assert.match(sql, /public\.create_product\(target_workspace_id, zero_stock_payload\)/i);
  assert.match(sql, /public\.record_purchase\(/i);
  assert.match(sql, /'funding_source', 'capital'/i);
  assert.match(sql, /grant execute on function public\.create_product_with_capital\(uuid, jsonb\) to authenticated/i);
});

test("latest migrations remain ordered and are present in the repository", async () => {
  const files = [
    "20261123130000_enforce_capital_purchase_accounting.sql",
    "20261123140000_capital_editing.sql",
    "20261123150000_create_product_with_capital.sql",
    "20261123160000_capital_account_amount_editing.sql",
    "20261123170000_remove_empty_product_after_purchase_cancellation.sql",
    "20261123180000_allow_non_capital_purchases.sql",
    "20261124100000_enforce_capital_edit_permissions.sql",
  ];
  const contents = await Promise.all(files.map(migration));
  assert.equal(contents.length, 7);
  assert.ok(contents.every((content) => content.trim().length > 0));
});

test("permission enforcement avoids E-string backslash parsing and covers capital editing", async () => {
  const permissionSql = await migration("20261102170000_permission_enforcement.sql");
  const capitalSql = await migration("20261124100000_enforce_capital_edit_permissions.sql");
  assert.doesNotMatch(permissionSql, /E'[^']*\\\\/i);
  assert.match(capitalSql, /public\.update_capital_account\(uuid,uuid,jsonb\)/i);
  assert.match(capitalSql, /public\.update_capital_entry\(uuid,uuid,jsonb\)/i);
  assert.match(capitalSql, /require_workspace_permission/i);
});

test("non-capital purchases do not require a capital account", async () => {
  const sql = await migration("20261123180000_allow_non_capital_purchases.sql");
  assert.match(sql, /coalesce\(new\.funding_source, 'supplier-credit'\) <> 'capital'/i);
  assert.match(sql, /return new/i);
  assert.match(sql, /capital-funded supplier purchase must use a capital account/i);
  assert.match(sql, /public\.capital_available/i);
});

test("capital account editing updates the opening contribution amount", async () => {
  const sql = await migration("20261123160000_capital_account_amount_editing.sql");
  assert.match(sql, /opening_amount/i);
  assert.match(sql, /update public\.capital_entries/i);
  assert.match(sql, /insert into public\.capital_entries/i);
  assert.match(sql, /grant execute on function public\.update_capital_account\(uuid, uuid, jsonb\) to authenticated/i);
});

test("purchase cancellation can remove only an unused product with no remaining history", async () => {
  const sql = await migration("20261123170000_remove_empty_product_after_purchase_cancellation.sql");
  assert.match(sql, /create or replace function public\.cancel_purchase/i);
  assert.match(sql, /not exists \(select 1 from public\.sale_items/i);
  assert.match(sql, /not exists \(select 1 from public\.purchase_items/i);
  assert.match(sql, /delete from public\.products/i);
  assert.match(sql, /grant execute on function public\.cancel_purchase\(uuid, uuid\) to authenticated/i);
});
