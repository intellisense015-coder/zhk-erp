# Solexa production testing pack

This is the release gate for the Solexa ERP application. Run the automated
checks against a production build first, then run the authenticated workflow
matrix against a dedicated staging workspace. Never run mutation tests against
real business data.

## 1. Release gate

```powershell
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run start
$env:BASE_URL = "http://localhost:3000"
npm run test:smoke
```

The smoke test is read-only. It checks public pages, protected-route auth
redirects, HTML responses, and the `/` to `/splash` redirect.

## 2. Supabase database gate

Inspect the linked project first. `migration list` is read-only and shows the
local/remote version pairs:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase migration list --remote
```

Apply migrations only after reviewing the pending list and taking the normal
database backup/release approval:

```powershell
npx supabase db push --remote --yes
```

Then verify the production contract either in the Supabase SQL Editor or with
the linked CLI target:

```powershell
npx supabase db query --remote --file supabase/tests/production_contract.sql --yes
```

The contract is schema-only: it checks required tables, RLS, and mutation RPCs,
including the atomic `create_product_with_capital` function. The CLI's
`--read-only` mode accepts only SELECT-like statements and therefore rejects
the contract's PostgreSQL `DO` assertion block; `--yes` is required by the CLI
to run this assertion block non-interactively. Review the SQL before running it
and never use this command for an untrusted file.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for invitation and MFA-recovery server routes

The service-role key must exist only in server-side deployment configuration;
it must never be prefixed with `NEXT_PUBLIC_` or committed to the repository.

## 3. Auth and access matrix

Use separate staging users for each role and test every protected route:

| Scenario | Expected result |
| --- | --- |
| Anonymous user opens `/dashboard` | Redirects to `/login` |
| Valid credentials | Lands in workspace access flow or dashboard |
| Invalid password | Red error; no session created |
| Expired/reused recovery link | Rejected; no password mutation |
| MFA not enrolled | MFA setup is required before ERP access |
| MFA invalid or stale code | Access denied; no ERP data exposed |
| Owner | Can manage workspace, members, permissions, and ERP records |
| Manager | Can perform permitted operational writes, but not owner-only actions |
| Restricted member | Sees only assigned modules and cannot bypass permissions by URL/API |
| Sign out | Session is cleared and protected routes redirect to login |

## 4. Onboarding matrix

1. New authenticated user opens `/onboarding` with empty fields.
2. Confirm no error appears before interaction.
3. Submit blank business details; required errors are red and field-specific.
4. Enter valid business details and continue to owner details.
5. Confirm email and contact number are prefilled from the authenticated account.
6. Submit invalid contact number; confirm the red validation message.
7. Complete a valid workspace; confirm redirect to `/dashboard`.
8. Refresh and sign in again; confirm the workspace is loaded from Supabase.
9. Attempt the same email/contact pair again; confirm duplicate rejection only when a matching workspace actually exists.
10. Inspect browser storage; onboarding/workspace data must not be persisted there.

## 5. Capital and inventory accounting matrix

Use a fresh staging workspace. Record exact before/after balances.

1. Add capital of Rs 1,000,000. Available capital must be Rs 1,000,000.
2. Add a product with 10 units at Rs 20,000 cost. Total stock cost is Rs 200,000.
3. Select the capital account and save. Product, supplier, purchase, stock movement,
   audit log, and capital reservation must be created atomically.
4. Available capital must be Rs 800,000; profit must remain separate.
5. Attempt a Rs 900,000 purchase. It must be rejected with an insufficient-capital error.
6. Confirm the rejected attempt creates no product, purchase, stock movement, or audit row.
7. Edit a capital account name and opening amount; later movements must remain unchanged.
8. Edit a contribution or withdrawal; available capital must recalculate exactly once.
9. Edit a purchase quantity/cost; stock, purchase total, and capital reservation must all change together.
10. Cancel a purchase; stock and capital reservation must reverse exactly once.
11. Record a supplier settlement linked to a purchase; it must not deduct capital twice.
12. Record a standalone capital-funded payment; it must reduce available capital once.

For the edit and cancellation cases, use the **Purchases** page. Inventory product
editing is for catalog metadata and pricing; stock quantity changes must use
**Purchases → Edit purchase** or **Add stock** so the stock movement, purchase total,
supplier balance, and capital reservation stay atomic. Inventory's trash action is a
hard-delete for products with no history. A product with purchase or sales history
must be reversed with the corresponding purchase cancellation/sale workflow instead
of being deleted.

## 6. Sales, profit, and stock matrix

1. Create a customer with valid contact data; duplicate contact rules must hold.
2. Sell one product with a discount; stock decreases by sold quantity.
3. Gross profit equals sale revenue minus discount minus cost basis.
4. Sell multiple products; line-item profits sum to transaction profit.
5. Attempt to sell more stock than available; transaction is blocked and state is unchanged.
6. Edit a sale; stock and profit reflect the delta, not a second full sale.
7. Record an exchange/trade-in; inventory, credit, amount due, and profit remain consistent.
8. Verify dashboard, sales, reports, transactions, and invoice totals agree.

## 7. Supplier, expense, and reporting matrix

1. Create, edit, and delete a supplier subject to contact rules.
2. Record a supplier payment with and without capital funding.
3. Create an expense category and expense; edit and delete it.
4. Net profit equals gross profit minus expenses.
5. Verify month filters, pagination, sorting, empty states, and invoice links.
6. Print and download representative sales, purchase, and expense invoices.

## 8. UI and browser matrix

Run the authenticated matrix in Chromium, Firefox, and WebKit at desktop and
mobile widths:

- Light/dark theme toggle persists only as a presentation preference.
- No text or input loses contrast in either theme.
- Capital account and available amount stay side-by-side in Add Product.
- Buttons have text-only styling where specified, normal font weight, and no dark-mode elevation.
- Toasts appear once, use the configured Sileo presentation, and disappear/close correctly.
- Modals trap focus, close on Escape where intended, and do not scroll the page behind them.
- Keyboard-only navigation reaches every control in logical order.
- Validation errors are red, announced with `role="alert"`, and do not clear valid input.
- Tables remain usable at narrow widths and action buttons have unique accessible labels.

## 9. Failure triage

- `create_product_with_capital ... schema cache`: apply the latest Supabase migrations and retry; do not bypass the RPC with client-side table writes.
- `workspace access` load error: inspect the authenticated session, MFA level, workspace membership RPC, and RLS policies.
- A balance differs by the purchase total: inspect transaction `capital_id`, `funding_source`, linked supplier payment, and cancellation/edit triggers.
- A route renders blank: capture browser console errors, network failures, and the server build output before changing UI code.

## 10. Production sign-off evidence

Attach the following to the release record:

- Output from `npm run test:release`.
- Output from `npm run test:smoke` against the production build.
- Supabase migration version list and `production_contract.sql` result.
- Auth/MFA/role matrix results.
- Before/after accounting screenshots or exported rows for the capital scenario.
- Browser/device matrix results and known limitations.
- Rollback plan: previous application deployment plus database migration rollback instructions.
