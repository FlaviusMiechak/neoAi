// lib/auth.ts
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

const SESSION_COOKIE = 'session_token'
const SESSION_DAYS = 365

export interface User {
  id: string
  email: string
  name?: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// Password hashing (scrypt, built-in) — unchanged
// ─────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false

  const computed = crypto.scryptSync(password, salt, 64).toString('hex')
  const storedBytes = Buffer.from(hash, 'hex')
  const computedBytes = Buffer.from(computed, 'hex')
  if (storedBytes.length !== computedBytes.length) return false

  const storedView = new Uint8Array(new ArrayBuffer(storedBytes.length))
  const computedView = new Uint8Array(new ArrayBuffer(computedBytes.length))
  storedView.set(storedBytes)
  computedView.set(computedBytes)
  return crypto.timingSafeEqual(storedView, computedView)
}

// ─────────────────────────────────────────────────────────────
// Signup
// ─────────────────────────────────────────────────────────────

export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email required')
  if (!password || password.length < 6) throw new Error('Password too short')

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .limit(1)

  if (lookupError) throw new Error(lookupError.message)
  if (existing && existing.length > 0) throw new Error('Email already registered')

  const id = crypto.randomUUID()
  const password_hash = hashPassword(password)

  const { error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      id,
      email: normalizedEmail,
      name: name ?? null,
      password_hash,
    })

  if (insertError) throw new Error(insertError.message)

  return {
    id,
    email: normalizedEmail,
    name,
    createdAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()

  const { data: rows, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, password_hash, created_at')
    .eq('email', normalizedEmail)
    .limit(1)

  if (lookupError) throw new Error(lookupError.message)
  const user = rows?.[0]
  if (!user) throw new Error('Invalid credentials')

  if (!verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid credentials')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const { error: sessionError } = await supabaseAdmin
    .from('sessions')
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    })

  if (sessionError) throw new Error(sessionError.message)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    createdAt: new Date(user.created_at).toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await supabaseAdmin.from('sessions').delete().eq('token', token)
  }

  cookieStore.delete(SESSION_COOKIE)
}

// ─────────────────────────────────────────────────────────────
// Session lookup (for API routes)
// ─────────────────────────────────────────────────────────────

export async function getUserIdFromRequest(): Promise<string | null> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value
  if (!sessionToken) return null

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
    .eq('token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .limit(1)

  if (error || !data?.[0]) return null
  return data[0].user_id
}

// ─────────────────────────────────────────────────────────────
// Current user (for server components)
// ─────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionToken) return null

  // 1) find session
  const { data: sessionRows, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
    .eq('token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .limit(1)

  if (sessionError || !sessionRows?.[0]) return null

  // 2) fetch the user
  const { data: userRows, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at')
    .eq('id', sessionRows[0].user_id)
    .limit(1)

  if (userError || !userRows?.[0]) return null
  const user = userRows[0]

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    createdAt: new Date(user.created_at).toISOString(),
  }
}