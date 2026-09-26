// src/components/RequireProject.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCurrentProject } from '@/lib/useCurrentProject'

export function RequireProject({ children }: { children: React.ReactNode }) {
  const { currentProjectId } = useCurrentProject()
  const [checking, setChecking] = useState(true)
  const [hasAnyProject, setHasAnyProject] = useState(false)

  useEffect(() => {
    if (currentProjectId) {
      setChecking(false)
      return
    }

    let cancelled = false

    fetch('/api/projects', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((projects: any[]) => {
        if (cancelled) return
        setHasAnyProject(Array.isArray(projects) && projects.length > 0)
        setChecking(false)
      })
      .catch(() => {
        if (cancelled) return
        setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentProjectId])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">📂</div>
          <h1 className="text-2xl font-bold mb-2">
            {hasAnyProject ? 'Pick a project first' : 'Create a project first'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {hasAnyProject
              ? 'You need to select a project before generating content.'
              : 'Every generation belongs to a project. Create one to get started.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/project"
              className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted"
            >
              {hasAnyProject ? 'Choose project' : 'View projects'}
            </Link>
            <Link
              href="/project/new"
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90"
            >
              New project
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}