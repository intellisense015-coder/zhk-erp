'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from './config'

let browserClient: SupabaseClient | null = null

/**
 * Creates the browser client only when environment configuration exists.
 * The current app remains local-first until the data layer is migrated.
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) {
    return browserClient
  }

  const env = getSupabaseEnv()
  if (!env) {
    return null
  }

  browserClient = createBrowserClient(env.url, env.publishableKey)
  return browserClient
}
