import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserIdFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromRequest()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('manual_payments')
    .select('id, amount_cents, currency, payment_reference, proof_url, status, admin_note, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('[payments] list failed:', error.message)
    return NextResponse.json({ error: 'Failed to load payment submissions' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { amountCents?: number; currency?: string; reference?: string; proofUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const amountCents = body.amountCents
  const currency = (body.currency ?? 'USD').trim().toUpperCase()
  const reference = body.reference?.trim()
  const proofUrl = body.proofUrl?.trim() || null

  if (!Number.isSafeInteger(amountCents) || !amountCents || amountCents < 1 || amountCents > 100_000_000) {
    return NextResponse.json({ error: 'Enter a valid payment amount' }, { status: 400 })
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'Currency must be a three-letter code' }, { status: 400 })
  }
  if (!reference || reference.length < 3 || reference.length > 160) {
    return NextResponse.json({ error: 'Payment reference must be 3 to 160 characters' }, { status: 400 })
  }
  if (proofUrl) {
    try {
      const parsedUrl = new URL(proofUrl)
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('Invalid protocol')
    } catch {
      return NextResponse.json({ error: 'Proof URL must be a valid HTTP or HTTPS link' }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('manual_payments')
    .insert({
      id: randomUUID(),
      user_id: userId,
      amount_cents: amountCents,
      currency,
      payment_reference: reference,
      proof_url: proofUrl,
    })
    .select('id, amount_cents, currency, payment_reference, proof_url, status, submitted_at')
    .single()

  if (error || !data) {
    console.error('[payments] submit failed:', error?.message)
    return NextResponse.json({ error: 'Could not submit payment for review' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}