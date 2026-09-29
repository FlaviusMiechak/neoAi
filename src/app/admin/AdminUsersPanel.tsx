'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  Check,
  CreditCard,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldCheck,
  Send,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name: string | null
  created_at: string
}

interface AdminProject {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface AdminGeneration {
  id: string
  project_id: string
  mode: string
  prompt: string
  created_at: string
}

interface AdminEdit {
  generation_id: string
  timeline: unknown
}

interface AdminPayment {
  id: string
  user_id: string
  amount_cents: number
  currency: string
  payment_reference: string
  proof_url: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  admin_note: string | null
  submitted_at: string
  user: AdminUser | null
}

interface AdminOverview {
  counts: {
    users: number
    projects: number
    generations: number
    edits: number
  }
  users: AdminUser[]
  projects: AdminProject[]
  generations: AdminGeneration[]
  edits: AdminEdit[]
}

type AdminSection = 'overview' | 'users' | 'projects' | 'generations' | 'edits' | 'payments' | 'notifications'

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: UsersRound },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'generations', label: 'Generations', icon: Sparkles },
  { id: 'edits', label: 'Edits', icon: Layers3 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function getClipCount(timeline: unknown) {
  let parsed = timeline
  if (typeof timeline === 'string') {
    try {
      parsed = JSON.parse(timeline)
    } catch {
      return 0
    }
  }

  if (!parsed || typeof parsed !== 'object' || !('clips' in parsed)) return 0
  const clips = (parsed as { clips?: unknown }).clips
  return Array.isArray(clips) ? clips.length : 0
}

export default function AdminUsersPanel({ currentUserId }: { currentUserId: string }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSection>('overview')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [reviewingPaymentId, setReviewingPaymentId] = useState<string | null>(null)
  const [notificationRecipient, setNotificationRecipient] = useState('all')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notificationResult, setNotificationResult] = useState('')
  const [error, setError] = useState('')

  async function loadOverview() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load admin data')
      setOverview(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function loadPayments() {
    setPaymentsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/payments', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load payments')
      setPayments(Array.isArray(result) ? result : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load payments')
    } finally {
      setPaymentsLoading(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'payments') void loadPayments()
  }, [activeSection])

  const normalizedQuery = query.trim().toLowerCase()
  const users = overview?.users ?? []
  const projects = overview?.projects ?? []
  const generations = overview?.generations ?? []
  const edits = overview?.edits ?? []
  const counts = overview?.counts ?? { users: 0, projects: 0, generations: 0, edits: 0 }
  const usersById = new Map(users.map((user) => [user.id, user]))
  const projectsById = new Map(projects.map((project) => [project.id, project]))

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users
    return users.filter((user) =>
      `${user.name ?? ''} ${user.email}`.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, users])

  const filteredProjects = projects.filter((project) => {
    const owner = usersById.get(project.user_id)
    return `${project.name} ${project.description ?? ''} ${owner?.email ?? ''}`
      .toLowerCase().includes(normalizedQuery)
  })
  const filteredGenerations = generations.filter((generation) => {
    const project = projectsById.get(generation.project_id)
    const owner = project ? usersById.get(project.user_id) : undefined
    return `${generation.mode} ${generation.prompt} ${project?.name ?? ''} ${owner?.email ?? ''}`
      .toLowerCase().includes(normalizedQuery)
  })
  const filteredEdits = edits.filter((edit) => {
    const generation = generations.find((item) => item.id === edit.generation_id)
    const project = generation ? projectsById.get(generation.project_id) : undefined
    return `${edit.generation_id} ${generation?.prompt ?? ''} ${project?.name ?? ''}`
      .toLowerCase().includes(normalizedQuery)
  })

  async function deleteUser(user: AdminUser) {
    const label = user.name || user.email
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return

    setDeletingId(user.id)
    setError('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete user')
      setOverview((current) => current ? {
        ...current,
        counts: { ...current.counts, users: Math.max(0, current.counts.users - 1) },
        users: current.users.filter((entry) => entry.id !== user.id),
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete user')
    } finally {
      setDeletingId(null)
    }
  }

  async function reviewPayment(paymentId: string, status: 'confirmed' | 'rejected') {
    const payment = payments.find((item) => item.id === paymentId)
    const action = status === 'confirmed' ? 'confirm' : 'reject'
    if (!payment || !window.confirm(`${action === 'confirm' ? 'Confirm' : 'Reject'} this payment from ${payment.user?.email ?? 'this user'}?`)) return

    setReviewingPaymentId(paymentId)
    setError('')
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to review payment')
      setPayments((current) => current.map((item) => item.id === paymentId ? { ...item, ...result } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to review payment')
    } finally {
      setReviewingPaymentId(null)
    }
  }

  async function sendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSendingNotification(true)
    setError('')
    setNotificationResult('')
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allUsers: notificationRecipient === 'all',
          userId: notificationRecipient === 'all' ? undefined : notificationRecipient,
          title: notificationTitle,
          message: notificationMessage,
          sendEmail,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to send notification')
      setNotificationResult(`${result.notificationsCreated} in-app notification${result.notificationsCreated === 1 ? '' : 's'} created${sendEmail ? `; ${result.emailsSent} email${result.emailsSent === 1 ? '' : 's'} sent${result.emailsFailed ? `, ${result.emailsFailed} failed` : ''}` : ''}.`)
      setNotificationTitle('')
      setNotificationMessage('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send notification')
    } finally {
      setSendingNotification(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-border bg-muted/20 px-4 py-5 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-8">
          <div className="mb-5 flex items-center gap-3 px-2 lg:mb-9">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Control center</p>
              <p className="text-xs text-muted-foreground">Admin workspace</p>
            </div>
          </div>
          <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto lg:flex-col">
            {sections.map((section) => {
              const Icon = section.icon
              const active = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Administration</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {sections.find((section) => section.id === activeSection)?.label}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Monitor accounts, projects, and creative activity across your workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              title="Refresh admin data"
              aria-label="Refresh admin data"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </header>

          {error && (
            <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {activeSection === 'overview' && (
            <>
              <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
                {[
                  { label: 'Users', value: counts.users, icon: UsersRound, section: 'users' as const },
                  { label: 'Projects', value: counts.projects, icon: FolderKanban, section: 'projects' as const },
                  { label: 'Generations', value: counts.generations, icon: Sparkles, section: 'generations' as const },
                  { label: 'Edits', value: counts.edits, icon: Layers3, section: 'edits' as const },
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <button
                      key={metric.label}
                      type="button"
                      onClick={() => setActiveSection(metric.section)}
                      className="border-b border-r border-border px-4 py-5 text-left hover:bg-muted/30 sm:py-6"
                    >
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon aria-hidden="true" className="h-4 w-4" />{metric.label}
                      </span>
                      <span className="mt-2 block text-2xl font-semibold tabular-nums">{loading && !overview ? '—' : metric.value}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-8 grid gap-10 xl:grid-cols-[1.2fr_0.8fr]">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Activity aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Recent generations</h2>
                  </div>
                  <ActivityTable generations={generations.slice(0, 8)} projectsById={projectsById} usersById={usersById} />
                </section>
                <section>
                  <h2 className="mb-4 text-base font-semibold">Recently joined</h2>
                  <UserTable users={users.slice(0, 8)} currentUserId={currentUserId} deletingId={deletingId} onDelete={deleteUser} />
                </section>
              </div>
            </>
          )}

          {activeSection !== 'overview' && activeSection !== 'payments' && activeSection !== 'notifications' && (
            <div className="mt-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {activeSection === 'users' && `${counts.users} accounts`}
                  {activeSection === 'projects' && `${counts.projects} projects`}
                  {activeSection === 'generations' && `${counts.generations} generations`}
                  {activeSection === 'edits' && `${counts.edits} edit timelines`}
                  <span className="ml-2">Showing the latest {activeSection === 'users' ? users.length : activeSection === 'projects' ? projects.length : activeSection === 'generations' ? generations.length : edits.length} records.</span>
                </p>
                <label className="relative block w-full sm:w-80">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${activeSection}`}
                    className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              {activeSection === 'users' && <UserTable users={filteredUsers} currentUserId={currentUserId} deletingId={deletingId} onDelete={deleteUser} />}
              {activeSection === 'projects' && <ProjectTable projects={filteredProjects} usersById={usersById} />}
              {activeSection === 'generations' && <ActivityTable generations={filteredGenerations} projectsById={projectsById} usersById={usersById} />}
              {activeSection === 'edits' && <EditTable edits={filteredEdits} generations={generations} projectsById={projectsById} />}
            </div>
          )}

          {activeSection === 'payments' && (
            <section className="mt-7">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Manual payment submissions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review references and confirm or reject pending payments.</p>
                </div>
                <button type="button" onClick={() => void loadPayments()} disabled={paymentsLoading} title="Refresh payments" aria-label="Refresh payments" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50">
                  <RefreshCw aria-hidden="true" className={`h-4 w-4 ${paymentsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <TableFrame minWidth="min-w-[900px]">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-medium">User</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Reference</th><th className="px-5 py-3 font-medium">Submitted</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Review</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {paymentsLoading && payments.length === 0 ? <EmptyRow colSpan={6} message="Loading payment submissions…" /> : payments.length === 0 ? <EmptyRow colSpan={6} message="No payment submissions yet." /> : payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30">
                      <td className="px-5 py-4">{payment.user?.email ?? 'Unknown user'}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium tabular-nums">{new Intl.NumberFormat(undefined, { style: 'currency', currency: payment.currency }).format(payment.amount_cents / 100)}</td>
                      <td className="max-w-xs px-5 py-4"><p className="truncate">{payment.payment_reference}</p>{payment.proof_url && <a href={payment.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">Open proof</a>}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(payment.submitted_at)}</td>
                      <td className="px-5 py-4"><span className="capitalize">{payment.status}</span></td>
                      <td className="px-5 py-4">
                        {payment.status === 'pending' ? <div className="flex gap-2">
                          <button type="button" onClick={() => void reviewPayment(payment.id, 'confirmed')} disabled={reviewingPaymentId !== null} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"><Check aria-hidden="true" className="h-3.5 w-3.5" />Confirm</button>
                          <button type="button" onClick={() => void reviewPayment(payment.id, 'rejected')} disabled={reviewingPaymentId !== null} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"><X aria-hidden="true" className="h-3.5 w-3.5" />Reject</button>
                        </div> : <span className="text-xs text-muted-foreground">{payment.admin_note || 'Reviewed'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="mt-7 max-w-3xl">
              <div className="mb-5">
                <h2 className="text-base font-semibold">Send a notification</h2>
                <p className="mt-1 text-sm text-muted-foreground">Create an in-app notice for one account or all users.</p>
              </div>
              <form onSubmit={sendNotification} className="space-y-5">
                <label className="block max-w-md text-sm font-medium">
                  Recipient
                  <select value={notificationRecipient} onChange={(event) => setNotificationRecipient(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring">
                    <option value="all">All users ({counts.users})</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name ? `${user.name} · ${user.email}` : user.email}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Title
                  <input value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} maxLength={120} required className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="block text-sm font-medium">
                  Message
                  <textarea value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} maxLength={5000} required rows={6} className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
                  <span><span className="font-medium">Also send by email</span><span className="mt-0.5 block text-xs text-muted-foreground">Requires SMTP_HOST, SMTP_PORT, SMTP_FROM, and matching SMTP credentials.</span></span>
                </label>
                {notificationResult && <p role="status" className="text-sm text-green-700 dark:text-green-400">{notificationResult}</p>}
                <button type="submit" disabled={sendingNotification || users.length === 0} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  <Send aria-hidden="true" className="h-4 w-4" />{sendingNotification ? 'Sending…' : 'Send notification'}
                </button>
              </form>
            </section>
          )}
        </section>
      </div>
    </main>
  )
}

function TableFrame({ children, minWidth = 'min-w-[620px]' }: { children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} border-collapse text-left text-sm`}>
          {children}
        </table>
      </div>
    </div>
  )
}

function UserTable({
  users,
  currentUserId,
  deletingId,
  onDelete,
}: {
  users: AdminUser[]
  currentUserId: string
  deletingId: string | null
  onDelete: (user: AdminUser) => void
}) {
  return (
    <TableFrame>
      <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
        <tr><th className="px-5 py-3 font-medium">User</th><th className="px-5 py-3 font-medium">Email</th><th className="px-5 py-3 font-medium">Joined</th><th className="w-16 px-4 py-3"><span className="sr-only">Actions</span></th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {users.length === 0 ? <EmptyRow colSpan={4} /> : users.map((user) => (
          <tr key={user.id} className="hover:bg-muted/30">
            <td className="px-5 py-4 font-medium">{user.name || 'Unnamed user'}{user.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}</td>
            <td className="px-5 py-4 text-muted-foreground">{user.email}</td>
            <td className="px-5 py-4 text-muted-foreground">{formatDate(user.created_at)}</td>
            <td className="px-4 py-3 text-right">
              <button type="button" onClick={() => onDelete(user)} disabled={user.id === currentUserId || deletingId !== null} title={user.id === currentUserId ? 'Your account cannot be deleted here' : 'Delete user'} aria-label={`Delete ${user.email}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  )
}

function ProjectTable({ projects, usersById }: { projects: AdminProject[]; usersById: Map<string, AdminUser> }) {
  return (
    <TableFrame>
      <thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Project</th><th className="px-5 py-3 font-medium">Owner</th><th className="px-5 py-3 font-medium">Created</th><th className="px-5 py-3 font-medium">Last updated</th></tr></thead>
      <tbody className="divide-y divide-border">
        {projects.length === 0 ? <EmptyRow colSpan={4} /> : projects.map((project) => (
          <tr key={project.id} className="hover:bg-muted/30"><td className="px-5 py-4"><p className="font-medium">{project.name}</p>{project.description && <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{project.description}</p>}</td><td className="px-5 py-4 text-muted-foreground">{usersById.get(project.user_id)?.email ?? 'Unknown user'}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(project.created_at)}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(project.updated_at)}</td></tr>
        ))}
      </tbody>
    </TableFrame>
  )
}

function ActivityTable({
  generations,
  projectsById,
  usersById,
}: {
  generations: AdminGeneration[]
  projectsById: Map<string, AdminProject>
  usersById: Map<string, AdminUser>
}) {
  return (
    <TableFrame minWidth="min-w-[720px]">
      <thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Activity</th><th className="px-5 py-3 font-medium">Project</th><th className="px-5 py-3 font-medium">User</th><th className="px-5 py-3 font-medium">Created</th></tr></thead>
      <tbody className="divide-y divide-border">
        {generations.length === 0 ? <EmptyRow colSpan={4} /> : generations.map((generation) => {
          const project = projectsById.get(generation.project_id)
          return <tr key={generation.id} className="hover:bg-muted/30"><td className="max-w-md px-5 py-4"><span className="mr-2 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-xs capitalize">{generation.mode}</span><span className="text-muted-foreground">{generation.prompt || 'No prompt'}</span></td><td className="px-5 py-4">{project?.name ?? 'Unknown project'}</td><td className="px-5 py-4 text-muted-foreground">{usersById.get(project?.user_id ?? '')?.email ?? 'Unknown user'}</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(generation.created_at)}</td></tr>
        })}
      </tbody>
    </TableFrame>
  )
}

function EditTable({
  edits,
  generations,
  projectsById,
}: {
  edits: AdminEdit[]
  generations: AdminGeneration[]
  projectsById: Map<string, AdminProject>
}) {
  const generationsById = new Map(generations.map((generation) => [generation.id, generation]))
  return (
    <TableFrame>
      <thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Generation</th><th className="px-5 py-3 font-medium">Project</th><th className="px-5 py-3 font-medium">Timeline clips</th><th className="px-5 py-3 font-medium">Created</th></tr></thead>
      <tbody className="divide-y divide-border">
        {edits.length === 0 ? <EmptyRow colSpan={4} /> : edits.map((edit) => {
          const generation = generationsById.get(edit.generation_id)
          const project = generation ? projectsById.get(generation.project_id) : undefined
          return <tr key={edit.generation_id} className="hover:bg-muted/30"><td className="max-w-sm px-5 py-4"><p className="truncate font-medium">{generation?.prompt || edit.generation_id}</p><p className="mt-1 text-xs text-muted-foreground">{edit.generation_id}</p></td><td className="px-5 py-4">{project?.name ?? 'Unknown project'}</td><td className="px-5 py-4 tabular-nums">{getClipCount(edit.timeline)}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(generation?.created_at)}</td></tr>
        })}
      </tbody>
    </TableFrame>
  )
}

function EmptyRow({ colSpan, message = 'No records found.' }: { colSpan: number; message?: string }) {
  return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-muted-foreground">{message}</td></tr>
}