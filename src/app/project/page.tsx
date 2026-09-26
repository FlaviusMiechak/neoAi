// src/app/project/page.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCurrentProject } from '@/lib/useCurrentProject'

interface Project {
  id: string
  name: string
  description?: string | null
  updated_at: string
  generation_count: number
}

function ProjectsList() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = searchParams.get('next')           // e.g. "/generate/text"
  const modeLabel = searchParams.get('mode')      // e.g. "Text"
  const isSelectionFlow = Boolean(next)

  const { setCurrentProject } = useCurrentProject()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function selectProject(id: string) {
    setCurrentProject(id)
    // If the user came from a mode card, send them to that mode.
    // Otherwise, open the project detail page.
    router.push(next || `/project/${id}`)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading projects…</p>
  }

  const newProjectHref = isSelectionFlow
    ? `/project/new?next=${encodeURIComponent(next!)}&mode=${encodeURIComponent(modeLabel ?? '')}`
    : '/project/new'

  return (
    <>
      <div className="flex items-start justify-between mb-8 gap-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isSelectionFlow ? 'Select a project' : 'My Projects'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSelectionFlow
              ? `Choose which project to use for ${modeLabel ?? 'this mode'}.`
              : 'All your generations, organized by project.'}
          </p>
        </div>

        <Link
          href={newProjectHref}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 whitespace-nowrap"
        >
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <div className="text-4xl mb-4">📂</div>
          <h2 className="text-lg font-semibold mb-1">No projects yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isSelectionFlow
              ? `You need a project before using ${modeLabel ?? 'this mode'}.`
              : 'Create your first project to start collecting generations.'}
          </p>
          <Link
            href={newProjectHref}
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create a project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p.id)}
              className="text-left rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:bg-muted"
            >
              <h3 className="font-semibold">{p.name}</h3>
              {p.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {p.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                {p.generation_count} generation
                {p.generation_count !== 1 ? 's' : ''}
              </p>
              <div className="mt-3 text-sm font-medium text-primary">
                {isSelectionFlow ? 'Use this project →' : 'Open →'}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ProjectsList />
        </Suspense>
      </section>
    </main>
  )
}