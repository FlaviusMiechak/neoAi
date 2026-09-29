'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, CreditCard, ExternalLink, RefreshCw } from 'lucide-react'

interface PaymentRecord {
  id: string
  amount_cents: number
  currency: string
  payment_reference: string
  proof_url: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  admin_note: string | null
  submitted_at: string
  reviewed_at: string | null
}

interface NotificationRecord {
  id: string
  title: string
  body: string
  created_at: string
  read_at: string | null
  email_sent_at: string | null
  email_error: string | null
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export default function AccountCommunications({ name }: { name: string }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [reference, setReference] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadAccountData() {
    setLoading(true)
    setError('')
    try {
      const [paymentsResponse, notificationsResponse] = await Promise.all([
        fetch('/api/payments', { cache: 'no-store' }),
        fetch('/api/notifications', { cache: 'no-store' }),
      ])
      const [paymentsData, notificationsData] = await Promise.all([
        paymentsResponse.json(),
        notificationsResponse.json(),
      ])
      if (!paymentsResponse.ok) throw new Error(paymentsData.error || 'Failed to load payment history')
      if (!notificationsResponse.ok) throw new Error(notificationsData.error || 'Failed to load notifications')
      setPayments(Array.isArray(paymentsData) ? paymentsData : [])
      setNotifications(Array.isArray(notificationsData) ? notificationsData : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load account activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccountData()
  }, [])

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const amountCents = Math.round(Number(amount) * 100)
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, currency, reference, proofUrl }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not submit payment')
      setMessage('Payment submitted for admin review.')
      setAmount('')
      setReference('')
      setProofUrl('')
      await loadAccountData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit payment')
    } finally {
      setSubmitting(false)
    }
  }

  async function markRead(notificationId: string) {
    setError('')
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update notification')
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read_at: result.read_at } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update notification')
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Payments and messages</h1>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {name}</p>
          </div>
          <button type="button" onClick={() => void loadAccountData()} disabled={loading} title="Refresh account activity" aria-label="Refresh account activity" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {error && <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-md border border-green-700/20 bg-green-700/5 px-4 py-3 text-sm text-green-800 dark:text-green-300">{message}</p>}

        <div className="grid gap-12 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <div className="mb-5 flex items-center gap-2">
              <CreditCard aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Submit a payment</h2>
            </div>
            <form onSubmit={submitPayment} className="space-y-4">
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <label className="block text-sm font-medium">
                  Amount
                  <input type="number" min="0.01" max="1000000" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="block text-sm font-medium">
                  Currency
                  <input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal uppercase outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Transfer reference
                <input required minLength={3} maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block text-sm font-medium">
                Proof link <span className="font-normal text-muted-foreground">(optional)</span>
                <input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://…" className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <button type="submit" disabled={submitting} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </form>

            <div className="mt-9 border-t border-border pt-5">
              <h3 className="mb-3 text-sm font-semibold">Payment history</h3>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payment submissions.</p> : <ul className="divide-y divide-border">
                {payments.map((payment) => <li key={payment.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div><p className="font-medium">{new Intl.NumberFormat(undefined, { style: 'currency', currency: payment.currency }).format(payment.amount_cents / 100)}</p><p className="mt-1 text-xs text-muted-foreground">{payment.payment_reference} · {formatDate(payment.submitted_at)}</p>{payment.admin_note && <p className="mt-1 text-xs text-muted-foreground">Admin note: {payment.admin_note}</p>}</div>
                  <span className="capitalize text-muted-foreground">{payment.status}</span>
                </li>)}
              </ul>}
            </div>
          </section>

          <section>
            <div className="mb-5 flex items-center gap-2">
              <Bell aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Notifications</h2>
            </div>
            {notifications.length === 0 ? <p className="border-y border-border py-8 text-sm text-muted-foreground">No notifications yet.</p> : <ul className="divide-y divide-border border-y border-border">
              {notifications.map((notification) => <li key={notification.id} className={`py-4 ${notification.read_at ? '' : 'bg-muted/20'}`}>
                <div className="flex items-start justify-between gap-4 px-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h3 className="font-medium">{notification.title}</h3>{!notification.read_at && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}{notification.email_sent_at ? ' · emailed' : ''}</p>
                  </div>
                  {!notification.read_at && <button type="button" onClick={() => void markRead(notification.id)} title="Mark as read" aria-label="Mark notification as read" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"><Check aria-hidden="true" className="h-4 w-4" /></button>}
                </div>
              </li>)}
            </ul>}
          </section>
        </div>
      </section>
    </main>
  )
}