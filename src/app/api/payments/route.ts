import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserIdFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notchpay } from '@/lib/notchpay'

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

// Existing: manual submission (user uploads proof, admin reviews)
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

// NEW: Initialize a Notch Pay checkout (automatic verification via webhook)
export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fail fast if the app URL isn't configured — otherwise the callback becomes
  // the literal string "undefined/..." and Notch Pay rejects with a 422.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || !/^https?:\/\//.test(appUrl)) {
    console.error('[payments] NEXT_PUBLIC_APP_URL is missing or invalid:', appUrl)
    return NextResponse.json(
      { error: 'Server misconfigured: NEXT_PUBLIC_APP_URL is not set' },
      { status: 500 }
    )
  }

  let body: { amountCents?: number; currency?: string; phone?: string; email?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { amountCents, currency, phone, email, name } = body

  if (!Number.isSafeInteger(amountCents) || !amountCents || amountCents < 1 || amountCents > 100_000_000) {
    return NextResponse.json({ error: 'Enter a valid payment amount' }, { status: 400 })
  }
  if (!currency || !/^[A-Z]{3}$/.test(currency.toUpperCase())) {
    return NextResponse.json({ error: 'Currency must be a three-letter code' }, { status: 400 })
  }
  if (!phone || !email || !name) {
    return NextResponse.json({ error: 'phone, email and name are required' }, { status: 400 })
  }

  // Generate internal reference BEFORE calling Notch Pay so we can match it
  // in the webhook callback.
  const internalReference = `PAY_${randomUUID()}`

  // XAF/XOF have no minor units, so amount == amountCents.
  // For USD/EUR/etc, convert cents -> major units.
  const normalizedCurrency = currency.toUpperCase()
  const notchAmount =
    normalizedCurrency === 'XAF' || normalizedCurrency === 'XOF'
      ? amountCents
      : amountCents / 100

  // Persist a pending record first so the webhook always has a row to update.
  const { data: pendingRow, error: insertError } = await supabaseAdmin
    .from('manual_payments')
    .insert({
      id: randomUUID(),
      user_id: userId,
      amount_cents: amountCents,
      currency: normalizedCurrency,
      payment_reference: internalReference,
      proof_url: null,
      status: 'pending',
    })
    .select('id, payment_reference')
    .single()

  if (insertError || !pendingRow) {
    console.error('[payments] pending insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 })
  }

  try {
    const response = await Promise.race([
      notchpay.payments.create({
        amount: notchAmount,
        currency: normalizedCurrency,
        description: `Payment ${internalReference}`,
        reference: internalReference,
        customer: {
          email,
          name,
          phone, // e.g. '+2376XXXXXXXX'
        },
        // Send the user back to /account so AccountCommunications can
        // auto-refresh using the ?ref= query param.
        callback: `${appUrl}/account?ref=${internalReference}`,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Notch Pay request timed out after 15s')),
          15_000
        )
      ),
    ])

    return NextResponse.json({
      authorizationUrl: response.authorization_url,
      transactionReference: response.transaction.reference,
      reference: internalReference,
    })
  } catch (error: unknown) {
    // Surface the actual Notch Pay error body so the frontend can show why.
    const axiosErr = error as {
      response?: { status?: number; data?: { message?: string; errors?: unknown } }
      message?: string
    }
    const status = axiosErr.response?.status
    const upstreamMessage = axiosErr.response?.data?.message
    const upstreamErrors = axiosErr.response?.data?.errors

    console.error('[payments] Notch Pay init failed', {
      status,
      message: upstreamMessage,
      errors: upstreamErrors,
      raw: axiosErr.message,
    })

    // Fire-and-forget cleanup so we don't block the error response on Supabase.
    void supabaseAdmin
      .from('manual_payments')
      .delete()
      .eq('id', pendingRow.id)

    const clientMessage =
      upstreamMessage ??
      (status === 422
        ? 'Payment details were rejected by the provider'
        : 'Payment initialization failed')

    return NextResponse.json(
      { error: clientMessage, details: upstreamErrors ?? null },
      { status: 502 }
    )
  }
}