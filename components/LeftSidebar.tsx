
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'

import { useCurrentProject } from '@/lib/useCurrentProject'
import { useSidebar } from '@/components/SidebarContext'

type NavigationItem = {
  id: string
  label: string
  icon: string
  description: string
  href: string
}

const PROJECTS: NavigationItem[] = [
  {
    id: 'activities',
    label: 'My Activities',
    icon: '📂',
    description: 'See all activities done by you',
    href: '/project',
  },
]

const MODES: NavigationItem[] = [
  {
    id: 'text',
    label: 'Text',
    icon: '📝',
    description: 'Generate articles, stories, and copy from a prompt.',
    href: '/generate/text',
  },
  {
    id: 'image',
    label: 'Image',
    icon: '🖼️',
    description: 'Turn a description into a polished image.',
    href: '/generate/image',
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '🎵',
    description: 'Create voice-overs and sound from text.',
    href: '/generate/audio',
  },
  {
    id: 'video',
    label: 'Video',
    icon: '🎬',
    description: 'Generate short cinematic clips with audio.',
    href: '/generate/video',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    description: 'Converse with the AI in real time.',
    href: '/generate/chat',
  },
]

function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {title}
      </h2>

      {action}
    </div>
  )
}

function NavigationCard({
  item,
  onNavigate,
}: {
  item: NavigationItem
  onNavigate?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-indigo-400/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-lg">
        {item.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white/85 transition group-hover:text-white">
          {item.label}
        </span>

        <span className="mt-1 block truncate text-xs text-white/40">
          {item.description}
        </span>
      </span>
    </Link>
  )
}

export default function LeftSidebar() {
  const router = useRouter()

  const { open, setOpen } = useSidebar()

  const { currentProjectId } = useCurrentProject()

  function closeMobileSidebar() {
    setOpen(false)
  }

  async function handleModeClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    label: string,
  ) {
    /*
     * If the user already has a project selected,
     * allow normal navigation to the generation mode.
     */
    if (currentProjectId) {
      closeMobileSidebar()
      return
    }

    /*
     * No project is selected.
     *
     * Prevent direct navigation and first determine
     * whether the user already has projects.
     */
    event.preventDefault()

    const params = new URLSearchParams({
      next: href,
      mode: label,
    })

    try {
      const response = await fetch('/api/projects', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch projects: ${response.status}`,
        )
      }

      const projects = await response.json()

      const hasProjects =
        Array.isArray(projects) && projects.length > 0

      closeMobileSidebar()

      if (hasProjects) {
        router.push(`/project?${params.toString()}`)
      } else {
        router.push(`/project/new?${params.toString()}`)
      }
    } catch {
      closeMobileSidebar()

      router.push(`/project/new?${params.toString()}`)
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        data-tour="sidebar"
        aria-label="Primary navigation"
        aria-hidden={!open}
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-72 min-w-0 flex-col',
          'overflow-x-hidden overflow-y-auto',
          'border-r border-white/[0.08]',
          'bg-[#08090d]',
          'transition-[transform,width,opacity] duration-200 ease-out',
          'md:static md:z-auto md:shrink-0 md:translate-x-0',
          open
            ? 'translate-x-0 md:w-72 md:opacity-100'
            : '-translate-x-full md:w-0 md:opacity-0 md:pointer-events-none',
        ].join(' ')}
      >
        <div className="flex min-h-full w-72 flex-col">
          {/* Sidebar header */}
          <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
              Workspace
            </span>

            <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-medium text-indigo-300">
              AI Studio
            </span>
          </div>

          {/* Projects */}
          <section className="px-4 pt-6">
            <SectionHeading
              title="Your projects"
              action={
                <Link
                  href="/project"
                  onClick={closeMobileSidebar}
                  className="text-[11px] font-medium text-indigo-400 transition hover:text-indigo-300"
                >
                  View all →
                </Link>
              }
            />

            <div className="grid gap-2">
              {PROJECTS.map((project) => (
                <NavigationCard
                  key={project.id}
                  item={project}
                  onNavigate={closeMobileSidebar}
                />
              ))}

              <Link
                href="/project/new"
                onClick={closeMobileSidebar}
                className="group flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-3 transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-dashed border-white/10 text-xl text-white/45 transition group-hover:text-indigo-300">
                  +
                </span>

                <span>
                  <span className="block text-sm font-medium text-white/80">
                    New Project
                  </span>

                  <span className="mt-1 block text-xs text-white/40">
                    Start from scratch
                  </span>
                </span>
              </Link>
            </div>
          </section>

          {/* Generation modes */}
          <section className="px-4 pb-6 pt-8">
            <SectionHeading
              title="Choose a mode"
              action={
                <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-white/40">
                  {MODES.length} modes
                </span>
              }
            />

            <nav
              aria-label="Generation modes"
              className="grid gap-1"
            >
              {MODES.map((mode) => (
                <Link
                  key={mode.id}
                  href={mode.href}
                  onClick={(event) =>
                    handleModeClick(
                      event,
                      mode.href,
                      mode.label,
                    )
                  }
                  className="group flex min-w-0 items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-white/[0.06] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.05] bg-white/[0.03] text-lg transition group-hover:border-indigo-400/20 group-hover:bg-indigo-500/10">
                    {mode.icon}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white/80 transition group-hover:text-white">
                        {mode.label}
                      </span>

                      <span className="text-xs text-white/25 opacity-0 transition group-hover:opacity-100">
                        →
                      </span>
                    </span>

                    <span className="mt-1 block text-xs leading-relaxed text-white/40">
                      {mode.description}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>

            <div className="mt-3 rounded-xl border border-dashed border-white/[0.08] p-3 text-center">
              <span className="text-sm">✦</span>

              <p className="mt-1 text-[11px] text-white/35">
                More modes coming soon
              </p>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-auto px-4 pb-5">
            <div className="rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/[0.12] to-blue-500/[0.03] p-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
                Your creative space
              </span>

              <h2 className="mt-2 text-sm font-semibold text-white">
                Ready to create?
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-white/45">
                Turn your next idea into something real with AI.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/generate"
                  onClick={closeMobileSidebar}
                  className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  Open Studio
                </Link>

                <Link
                  href="/account"
                  onClick={closeMobileSidebar}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Payments
                </Link>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

