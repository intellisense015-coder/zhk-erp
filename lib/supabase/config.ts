export type SupabaseEnv = {
  url: string
  publishableKey: string
}

/**
 * Returns the browser-safe Supabase configuration when it has been provided.
 * Keeping this optional lets Solexa continue running in local-only mode during
 * the staged migration from localStorage to Supabase.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()

  if (!url || !publishableKey) {
    return null
  }

  return { url, publishableKey }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null
}
