# Supabase integration

This directory is the home for the versioned Supabase database migrations and
seed data. No schema or application data has been moved yet.

The first migration will be added after the existing local ERP data model is
mapped to tables, relationships, constraints, RLS policies, and atomic stock
movement functions. Until then, `lib/erp-store.tsx` remains the source of truth
and the app continues to run in local-only mode.
