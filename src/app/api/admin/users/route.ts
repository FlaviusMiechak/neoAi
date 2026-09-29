import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!isAdminEmail(user.email)) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, response: null }
}

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/users] list failed:', error.message)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function DELETE(request: NextRequest) {
  const { user: admin, response } = await requireAdmin()
  if (response) return response

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const { data: target, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle()

  if (lookupError) {
    console.error('[admin/users] lookup failed:', lookupError.message)
    return NextResponse.json({ error: 'Failed to find user' }, { status: 500 })
  }

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (isAdminEmail(target.email)) {
    return NextResponse.json({ error: 'Admin accounts cannot be deleted here' }, { status: 400 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId)

  if (deleteError) {
    console.error('[admin/users] delete failed:', deleteError.message)
    return NextResponse.json(
      { error: 'Could not delete this user. Related project data may need to be removed first.' },
      { status: 409 }
    )
  }

  await supabaseAdmin.from('sessions').delete().eq('user_id', userId)

  return NextResponse.json({ ok: true })
}