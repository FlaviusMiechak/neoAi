import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isAdminEmail(user.email)) return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, response: null }
}

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const { data: payments, error } = await supabaseAdmin
    .from('manual_payments')
    .select('id, user_id, amount_cents, currency, payment_reference, proof_url, status, admin_note, submitted_at, reviewed_at')
    .order('submitted_at', { ascending: false })
    .limit(300)

  if (error) {
    console.error('[admin/payments] list failed:', error.message)
    return NextResponse.json({ error: 'Failed to load payment submissions' }, { status: 500 })
  }

  const userIds = [...new Set((payments ?? []).map((payment) => payment.user_id))]
  const { data: users, error: usersError } = userIds.length
    ? await supabaseAdmin.from('users').select('id, email, name').in('id', userIds)
    : { data: [], error: null }

  if (usersError) {
    console.error('[admin/payments] user lookup failed:', usersError.message)
    return NextResponse.json({ error: 'Failed to load payment users' }, { status: 500 })
  }

  const userMap = new Map((users ?? []).map((user) => [user.id, user]))
  return NextResponse.json((payments ?? []).map((payment) => ({
    ...payment,
    user: userMap.get(payment.user_id) ?? null,
  })))
}

export async function PATCH(request: NextRequest) {
  const { user: admin, response } = await requireAdmin()
  if (response) return response

  let body: { paymentId?: string; status?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const paymentId = body.paymentId?.trim()
  const status = body.status
  const note = body.note?.trim() ?? ''
  if (!paymentId || (status !== 'confirmed' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Payment and review status are required' }, { status: 400 })
  }
  if (note.length > 1000) {
    return NextResponse.json({ error: 'Review note cannot exceed 1000 characters' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('manual_payments')
    .update({
      status,
      admin_note: note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id, status, admin_note, reviewed_at')
    .maybeSingle()

  if (error) {
    console.error('[admin/payments] review failed:', error.message)
    return NextResponse.json({ error: 'Failed to review payment' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Payment not found or already reviewed' }, { status: 409 })
  }

  return NextResponse.json(data)
}