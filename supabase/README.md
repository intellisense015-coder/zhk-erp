# Supabase integration

This directory contains the versioned database schema, RLS policies, security
definer RPCs, and migration history for Solexa.

The current migration set provides authenticated workspace reads, secure product
mutations, and an atomic purchase/stock-entry operation. Remaining ERP writes
are intentionally staged and continue to use the local store until their secure
RPCs, audit coverage, and end-to-end tests are complete.
