# Solexa backend security gates

This document records the security requirements for connecting Solexa to
Supabase. A database connection is not considered production-ready until all
gates below pass.

## Current findings

- `.env` is ignored by Git and is not tracked.
- The application source contains no service-role key reference.
- The publishable key is the only key permitted in `NEXT_PUBLIC_*` variables.
- The current login and six-digit PIN screens are local UI flows, not real
  authentication. They must not be treated as authorization for database data.
- The initial migration enables RLS and allows direct member reads only. Direct
  table writes are intentionally withheld until authenticated server/RPC
  mutations are implemented.

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
