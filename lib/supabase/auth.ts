import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from './server'

/**
 * Server-side session lookup for the future data-access layer. Route guards
 * improve navigation UX, but every sensitive read or mutation must call this
 * (or an equivalent authorization check) close to the data source.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser()
  if (error) {
    return null
  }

  return data.user
})

export const requireCurrentUser = cache(async () => {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  return user
})
