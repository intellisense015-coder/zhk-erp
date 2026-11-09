"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseResource, loadSupabaseTransactionPage, type RemoteResource, type RemotePage, type RemoteStoreData, type TransactionPageFilters } from "./erp-read";
import type { Transaction } from "../erp-data";
import { createSupabaseBrowserClient } from "./browser";
import { isSupabaseConfigured } from "./config";

export const remoteResources = [
  "products",
  "customers",
  "suppliers",
  "transactions",
  "supplierPayments",
  "expenses",
  "expenseCategories",
  "capitalAccounts",
  "capitalEntries",
] as const satisfies readonly RemoteResource[];

export const erpQueryKeys = {
  workspace: (workspaceId: string) => ["erp", workspaceId] as const,
  resource: (workspaceId: string, resource: RemoteResource) => ["erp", workspaceId, resource] as const,
  transactionsPage: (workspaceId: string, filters: TransactionPageFilters) => ["erp", workspaceId, "transactions-page", filters] as const,
};

export function getRemoteResourceQueryKey(workspaceId: string, resource: RemoteResource): QueryKey {
  return erpQueryKeys.resource(workspaceId, resource);
}

export async function fetchRemoteResource<R extends RemoteResource>(
  supabase: SupabaseClient,
  workspaceId: string,
  resource: R,
): Promise<RemoteStoreData[R]> {
  const result = await loadSupabaseResource(supabase, workspaceId, resource);
  if (!result.data) throw new Error(result.error ?? `Unable to load ${resource}.`);
  return result.data as RemoteStoreData[R];
}

export async function fetchRemoteTransactionPage(
  supabase: SupabaseClient,
  workspaceId: string,
  filters: TransactionPageFilters,
): Promise<RemotePage<Transaction>> {
  const result = await loadSupabaseTransactionPage(supabase, workspaceId, filters);
  if (!result.data) throw new Error(result.error ?? "Unable to load transactions.");
  return result.data;
}

export function useRemoteTransactionPage(filters: TransactionPageFilters) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isSupabaseConfigured()) return;
      setWorkspaceId(window.localStorage.getItem("solexa-workspace-id"));
      setSupabase(createSupabaseBrowserClient());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: workspaceId ? erpQueryKeys.transactionsPage(workspaceId, filters) : ["erp", "disabled", "transactions-page", filters],
    queryFn: () => fetchRemoteTransactionPage(supabase as SupabaseClient, workspaceId as string, filters),
    enabled: Boolean(isSupabaseConfigured() && workspaceId && supabase),
  });

  return { ...query, isRemote: isSupabaseConfigured() && Boolean(workspaceId && supabase) };
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}
