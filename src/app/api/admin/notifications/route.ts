import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/admin'
import { sendNotificationEmail } from '@/lib/notifications'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(admin.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { userId?: string; allUsers?: boolean; title?: string; message?: string; sendEmail?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = body.title?.trim()
  const message = body.message?.trim()
  if (!title || title.length > 120 || !message || message.length > 5000) {
    return NextResponse.json({ error: 'Title and message are required; title must be 120 characters or less and message 5000 or less' }, { status: 400 })
  }
  if (body.allUsers && body.userId) {
    return NextResponse.json({ error: 'Choose one user or all users' }, { status: 400 })
  }
  if (!body.allUsers && !body.userId) {
    return NextResponse.json({ error: 'Choose a notification recipient' }, { status: 400 })
  }

  const { data: recipients, error: recipientError } = body.allUsers
    ? await supabaseAdmin.from('users').select('id, email')
    : await supabaseAdmin.from('users').select('id, email').eq('id', body.userId!).limit(1)

  if (recipientError) {
    console.error('[admin/notifications] recipient lookup failed:', recipientError.message)
    return NextResponse.json({ error: 'Failed to load notification recipients' }, { status: 500 })
  }
  if (!recipients?.length) return NextResponse.json({ error: 'No matching recipients found' }, { status: 404 })

  const createdAt = new Date().toISOString()
  const notifications = recipients.map((recipient) => ({
    id: randomUUID(),
    user_id: recipient.id,
    title,
    body: message,
    created_at: createdAt,
  }))

  const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications)
  if (insertError) {
    console.error('[admin/notifications] insert failed:', insertError.message)
    return NextResponse.json({ error: 'Failed to save notifications' }, { status: 500 })
  }

  let emailsSent = 0
  let emailsFailed = 0
  if (body.sendEmail) {
    const emailResults = await Promise.all(recipients.map(async (recipient, index) => {
      try {
        await sendNotificationEmail(recipient.email, title, message)
        const { error } = await supabaseAdmin
          .from('notifications')
          .update({ email_sent_at: new Date().toISOString(), email_error: null })
          .eq('id', notifications[index].id)
        if (error) throw error
        return true
      } catch (error) {
        console.error('[admin/notifications] email failed:', error instanceof Error ? error.message : error)
        await supabaseAdmin
          .from('notifications')
          .update({ email_error: 'Email delivery failed; check server SMTP configuration and logs.' })
          .eq('id', notifications[index].id)
        return false
      }
    }))
    emailsSent = emailResults.filter(Boolean).length
    emailsFailed = emailResults.length - emailsSent
  }

  return NextResponse.json({
    notificationsCreated: notifications.length,
    emailsSent,
    emailsFailed,
    emailRequested: Boolean(body.sendEmail),
  }, { status: 201 })
}