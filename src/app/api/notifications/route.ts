import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromRequest()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, title, body, created_at, read_at, email_sent_at, email_error')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[notifications] list failed:', error.message)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest) {
  const userId = await getUserIdFromRequest()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { notificationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const notificationId = body.notificationId?.trim()
  if (!notificationId) return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id, read_at')
    .maybeSingle()

  if (error) {
    console.error('[notifications] mark read failed:', error.message)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

  return NextResponse.json(data)
}