import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type UserRole = 'user' | 'admin'

/**
 * Look up a user's role directly from Supabase.
 */
export async function getUserRole(
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .limit(1)

  if (error || !data?.[0]) return null

  const role = data[0].role as string | null
  return role === 'admin' || role === 'user' ? role : null
}

/**
 * True if the user exists and their `role` column is 'admin'.
 */
export async function isAdmin(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false
  return (await getUserRole(userId)) === 'admin'
}

/**
 * Same, but looks the user up by email.
 */
export async function isAdminEmail(
  email: string | null | undefined
): Promise<boolean> {
  if (!email) return false

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('email', email.trim().toLowerCase())
    .limit(1)

  if (error || !data?.[0]) return false
  return data[0].role === 'admin'
}

/**
 * Throws if the user is not an admin. Use inside routes.
 */
export async function requireAdmin(
  userId: string | null | undefined
): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new Error('Forbidden: admin only')
  }
}