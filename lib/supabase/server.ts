import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getSupabaseEnv } from './config'

/**
 * Creates the cookie-aware server client used by the future server-side data
 * access layer. It returns null until the project environment is configured.
 */
export async function createSupabaseServerClient() {
  const env = getSupabaseEnv()
  if (!env) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies. The proxy/auth
          // refresh step will handle cookie persistence when it is added.
        }
      },
    },
  })
}
