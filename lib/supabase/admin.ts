import "server-only";

import { createClient } from "@supabase/supabase-js";

function requiredServerEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/**
 * Server-only Supabase Admin client.
 * Never import this module from client components or expose its key through
 * NEXT_PUBLIC_* environment variables.
 */
export function createSupabaseAdminClient() {
  return createClient(
    requiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
