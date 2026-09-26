'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCurrentProject } from '@/lib/useCurrentProject'

function NewProjectForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/project'
  const { setCurrentProject } = useCurrentProject()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }

      const project = await res.json()
      // Make the new project the "current" one, then return to the mode
      setCurrentProject(project.id)
      router.push(next)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}

export default function NewProjectPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">New Project</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Give your project a name. You&apos;ll be taken to your mode right after.
        </p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <NewProjectForm />
        </Suspense>
      </section>
    </main>
  )
}