import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseEnv } from './config'

const publicPaths = new Set([
  '/splash',
  '/login',
  '/forgot-password',
  '/forgot-pin',
  '/reset-password',
])

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname)
}

/**
 * Refreshes the Supabase Auth session and applies the first route-level guard.
 * Database RLS and server-side authorization remain the final security layer.
 */
export async function updateSupabaseSession(request: NextRequest) {
  const env = getSupabaseEnv()
  if (!env) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/splash')) {
    return NextResponse.redirect(new URL('/pin', request.url))
  }

  return response
}
