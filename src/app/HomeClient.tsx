'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentProject } from '@/lib/useCurrentProject'

type Mode = {
  id: string
  label: string
  icon: string
  description: string
  href: string
}

type ProjectCard = {
  id: string
  label: string
  icon: string
  description: string
  href: string
}

const PROJECTS: ProjectCard[] = [
  {
    id: 'project',
    label: 'My Activities',
    icon: '📂',
    description: 'See all activities done by you',
    href: '/project',
  },
]

const MODES: Mode[] = [
  { id: 'text', label: 'Text', icon: '📝', description: 'Generate articles, stories, and copy from a prompt.', href: '/generate/text' },
  { id: 'image', label: 'Image', icon: '🖼️', description: 'Turn a description into a polished image.', href: '/generate/image' },
  { id: 'audio', label: 'Audio', icon: '🎵', description: 'Create voice-overs and sound from text.', href: '/generate/audio' },
  { id: 'video', label: 'Video', icon: '🎬', description: 'Generate short cinematic clips with audio.', href: '/generate/video' },
  { id: 'chat', label: 'Chat', icon: '💬', description: 'Converse with the AI in real time.', href: '/generate/chat' },
]

export default function HomeClient() {
  const router = useRouter()
  const { currentProjectId } = useCurrentProject()

  async function handleModeClick(
    e: React.MouseEvent,
    href: string,
    label: string
  ) {
    if (currentProjectId) return

    e.preventDefault()
    const params = new URLSearchParams({ next: href, mode: label })

    try {
      const res = await fetch('/api/projects')
      const projects = await res.json()
      const hasProjects = Array.isArray(projects) && projects.length > 0

      router.push(
        hasProjects
          ? `/project?${params.toString()}`
          : `/project/new?${params.toString()}`
      )
    } catch {
      router.push(`/project/new?${params.toString()}`)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-12 text-center">
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          AI Video Studio
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Generate text, images, audio, video, and chat — all in one place.
          Pick a mode below and start creating.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/generate"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Open Studio
          </Link>
          <Link
            href="/generate/video"
            className="rounded-lg border border-border bg-background px-6 py-3 font-medium transition hover:bg-muted"
          >
            Try Video →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          See your projects
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((project) => (
            <Link
              key={project.id}
              href={project.href}
              className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/50 hover:bg-muted"
            >
              <div className="text-3xl">{project.icon}</div>
              <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">
                {project.label}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {project.description}
              </p>
              <div className="mt-4 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                Open {project.label} →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Choose a mode
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={mode.href}
              onClick={(e) => handleModeClick(e, mode.href, mode.label)}
              className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/50 hover:bg-muted"
            >
              <div className="text-3xl">{mode.icon}</div>
              <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">
                {mode.label}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode.description}
              </p>
              <div className="mt-4 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                Generate {mode.label.toLowerCase()} →
              </div>
            </Link>
          ))}

          <div className="hidden rounded-xl border border-dashed border-border p-6 lg:flex lg:flex-col lg:justify-center lg:items-center">
            <div className="text-3xl opacity-40">✨</div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              More modes coming soon
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        AI Video Studio · Built by Sahwah Flavius &amp; powered by Agnes
      </footer>
    </main>
  )
}