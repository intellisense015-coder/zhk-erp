# Solexa backend security gates

This document records the security requirements for connecting Solexa to
Supabase. A database connection is not considered production-ready until all
gates below pass.

## Current findings

- `.env` is ignored by Git and is not tracked.
- The application source contains no service-role key reference.
- The publishable key is the only key permitted in `NEXT_PUBLIC_*` variables.
- Supabase Auth establishes the session used for database access. The six-digit
  PIN is an additional local UI gate only; it is not treated as authorization.
- The initial migration enables RLS and allows direct member reads only. Direct
  table writes are intentionally withheld until authenticated server/RPC
  mutations are implemented.
- Explicit grants now deny anonymous table access and deny direct authenticated
  table writes. Approved security-definer RPCs are the mutation boundary.
- The device-catalog route is protected by the central proxy, validates query
  lengths/categories, applies a bounded per-instance request limiter, and
  never returns the upstream API key.
- Supabase reads are paginated in bounded batches and fail closed if a dataset
  exceeds the configured safety limit.

## Required controls

1. Supabase Auth must establish the user session before any ERP data is read.
2. Every query must be scoped by `workspace_id`; RLS must remain enabled on
   every exposed table.
3. Sales, purchases, expenses, payments, exchanges, capital movements, and
   stock changes must execute through validated server-side operations or
   security-definer RPCs. The browser must never be trusted with final totals,
   stock balances, permissions, or invoice sequence numbers.
4. Each mutation must verify authentication, workspace membership, role, input
   ownership, and business constraints inside the operation itself.
5. Service-role credentials must remain server-only and must never be placed in
   `.env.example`, client modules, browser bundles, or WhatsApp/PDF payloads.
6. Audit records must be written for sensitive mutations, including deletes,
   capital changes, stock adjustments, permission changes, and data imports.
7. Production migration must be preceded by a backup/export, a staging run,
   RLS tests, and a rollback plan.

## Required security tests before production

- Unauthenticated requests cannot read or mutate ERP tables.
- A user from workspace A cannot read or mutate workspace B by changing an ID.
- Staff cannot perform owner/manager actions.
- Direct table inserts and updates are rejected; approved RPCs succeed.
- Sale, purchase, exchange, payment, and stock operations are atomic on error.
- Invoice numbers remain unique under concurrent requests.
- Month/year reports cannot see records outside the selected workspace or date
  range.
- Password reset, session expiry, logout, and revoked membership are enforced.
- No build artifact or browser request contains a service-role credential.

## Current production blockers

- The in-process device-catalog limiter is defense-in-depth only. Before a
  multi-instance production launch, replace it with a shared provider such as
  Vercel WAF or Upstash Redis and test limits across instances.
- Sales, expenses, supplier/customer mutations, capital, exchanges, and
  transfers still need secure RPCs before those workflows are production-ready.
- Business profile/settings persistence and local-data import still need a
  server-side data-access path.
