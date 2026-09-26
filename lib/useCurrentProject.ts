// src/lib/useCurrentProject.ts
'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Generation {
  id: string
  mode: string
  prompt: string
  result: string
  createdAt: string
  metadata?: Record<string, any>
}

export interface Project {
  id: string
  userId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  generations: Generation[]
}

interface CurrentProjectState {
  currentProjectId: string | null
  project: Project | null
  loading: boolean
  error: string | null
  setCurrentProject: (id: string | null) => void
  clear: () => void
  fetchProject: (id?: string) => Promise<void>
  refreshProject: () => Promise<void>
}

function normalizeProject(raw: any, fallbackId: string): Project {
  return {
    id: raw?.id ?? fallbackId,
    userId: raw?.userId ?? raw?.user_id ?? '',
    name: raw?.name ?? '',
    description: raw?.description ?? undefined,
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? new Date().toISOString(),
    generations: Array.isArray(raw?.generations) ? raw.generations : [],
  }
}

export const useCurrentProject = create<CurrentProjectState>()(
  persist(
    (set, get) => ({
      currentProjectId: null,
      project: null,
      loading: false,
      error: null,

      setCurrentProject: (id) => {
        set({ currentProjectId: id, project: null, error: null })
        if (id) void get().fetchProject(id)
      },

      clear: () =>
        set({
          currentProjectId: null,
          project: null,
          loading: false,
          error: null,
        }),

      fetchProject: async (id) => {
        const targetId = id ?? get().currentProjectId
        if (!targetId) return
        set({ loading: true, error: null })
        try {
          const res = await fetch(`/api/projects/${targetId}`, {
            cache: 'no-store',
          })
          if (!res.ok) {
            if (res.status === 404) {
              set({
                currentProjectId: null,
                project: null,
                loading: false,
                error: 'Project not found',
              })
              return
            }
            throw new Error(`HTTP ${res.status}`)
          }
          const raw = await res.json()
          set({ project: normalizeProject(raw, targetId), loading: false })
        } catch (err: any) {
          set({
            loading: false,
            error: err?.message ?? 'Failed to load project',
          })
        }
      },

      refreshProject: async () => {
        const id = get().currentProjectId
        if (!id) return
        await get().fetchProject(id)
      },
    }),
    {
      name: 'current-project',
      partialize: (state) => ({ currentProjectId: state.currentProjectId }),
    }
  )
)

export function useRequireProject() {
  const currentProjectId = useCurrentProject((s) => s.currentProjectId)
  const project = useCurrentProject((s) => s.project)
  const loading = useCurrentProject((s) => s.loading)
  const fetchProject = useCurrentProject((s) => s.fetchProject)

  useEffect(() => {
    if (currentProjectId && !project && !loading) {
      void fetchProject(currentProjectId)
    }
  }, [currentProjectId, project, loading, fetchProject])

  const ready = Boolean(currentProjectId && project)
  const needsProject = !currentProjectId
  return { ready, needsProject, project, currentProjectId, loading }
}