// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

// Routes anyone can hit without being logged in
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
]

// Static asset prefixes — never gate these
const STATIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/icon',
  '/apple-touch-icon',
  '/uploads',
  '/generated',
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Allow static assets
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 2. Allow public pages and API endpoints
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // 3. Check for the session cookie
  const token = req.cookies.get('session_token')?.value

  if (!token) {
    // API → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Page → redirect to /login with ?next=<original>
    const url = req.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Run on everything except Next.js internals and static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}