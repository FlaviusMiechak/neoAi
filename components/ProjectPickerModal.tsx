'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCurrentProject } from '@/lib/useCurrentProject'

interface ProjectSummary {
  id: string
  name: string
  description?: string
  updatedAt?: string
  generations?: { id: string }[]
}

export function ProjectPickerModal({
  open,
  onClose,
  nextHref,
}: {
  open: boolean
  onClose?: () => void
  nextHref?: string
}) {
  const { setCurrentProject } = useCurrentProject()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    setError(null)

    fetch('/api/projects', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setProjects(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || 'Failed to load projects')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  function selectProject(id: string) {
    setCurrentProject(id)
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Select a project</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a project to start generating.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading && (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Loading projects…
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400 p-4 text-center">{error}</p>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="p-6 text-center space-y-3">
              <div className="text-3xl">📂</div>
              <p className="text-sm text-muted-foreground">
                You don't have any projects yet.
              </p>
              <Link
                href={
                  nextHref
                    ? `/project/new?next=${encodeURIComponent(nextHref)}`
                    : '/project/new'
                }
                className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                ✨ Create your first project
              </Link>
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => selectProject(p.id)}
                    className="w-full text-left rounded-lg px-4 py-3 hover:bg-muted transition"
                  >
                    <p className="font-medium truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {p.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {p.generations?.length ?? 0} generations
                      {p.updatedAt &&
                        ` · updated ${new Date(p.updatedAt).toLocaleDateString()}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/30">
          <Link
            href={
              nextHref
                ? `/project/new?next=${encodeURIComponent(nextHref)}`
                : '/project/new'
            }
            className="text-xs text-primary hover:underline"
          >
            ✨ New project
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}