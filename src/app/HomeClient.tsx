'use client'

/* ============================================================================
 * SECTION 1 — SidebarContext.tsx
 * Shared sidebar state (open/close), persistence, and keyboard shortcut.
 * ==========================================================================*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react'
import { useCurrentProject } from '@/lib/useCurrentProject'
import { useAgnes } from '@/components/AgnesProvider'

/* --------------------------- Sidebar Context ----------------------------- */

type SidebarContextValue = {
  open: boolean
  toggle: () => void
  setOpen: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

SidebarContext.displayName = 'SidebarContext'

/**
 * Routes that represent an individual generation mode.
 *
 * Examples:
 *   /generate/text
 *   /generate/image
 *   /generate/audio
 *   /generate/video
 *   /generate/chat
 *
 * An optional trailing slash is allowed.
 */
const MODE_ROUTE = /^\/generate\/(text|image|audio|video|chat)\/?$/

const SIDEBAR_STORAGE_KEY = 'sidebar:open'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const [open, setOpen] = useState(true)

  /*
   * Prevents the pathname effect from treating the initial
   * pathname as a navigation into a mode.
   */
  const previousPathname = useRef<string | null>(null)

  /* Restore the user's sidebar preference after hydration. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)

      if (saved === '1') {
        setOpen(true)
      } else if (saved === '0') {
        setOpen(false)
      }
    } catch {
      // localStorage may be unavailable. Keep the default state.
    }
  }, [])

  /* Persist sidebar state. */
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? '1' : '0')
    } catch {
      // Ignore storage errors.
    }
  }, [open])

  /*
   * Automatically close the sidebar only when the user
   * ENTERS a generation mode from a non-mode route.
   */
  useEffect(() => {
    const previous = previousPathname.current
    previousPathname.current = pathname

    // Ignore the initial render.
    if (previous === null) return

    const wasModeRoute = MODE_ROUTE.test(previous)
    const isModeRoute = MODE_ROUTE.test(pathname)

    if (isModeRoute && !wasModeRoute) {
      setOpen(false)
    }
  }, [pathname])

  /* Cmd+B / Ctrl+B sidebar shortcut. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isToggleShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'b'

      if (!isToggleShortcut) return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggle = useCallback(() => {
    setOpen((current) => !current)
  }, [])

  const value = useMemo(
    () => ({ open, toggle, setOpen }),
    [open, toggle],
  )

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error(
      '[useSidebar] No SidebarProvider found in the tree. ' +
        'Wrap the component or layout in <SidebarProvider>. ' +
        'TopBar and LeftSidebar must be rendered inside the provider.',
    )
  }

  return context
}

/* ============================================================================
 * SECTION 2 — TopBar.tsx
 * Sticky top navigation with sidebar toggle, nav links, and user chip.
 * ==========================================================================*/

export type TopBarUser = {
  id: string
  email: string
  name?: string
}

function getInitials(user: TopBarUser | null): string {
  if (!user) return '?'

  const source = (user.name?.trim() || user.email || '').trim()
  if (!source) return '?'

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return initials || '?'
}

export function TopBar({ user }: { user: TopBarUser | null }) {
  const { open, toggle } = useSidebar()

  const isLoggedIn = Boolean(user)
  const displayName =
    user?.name?.trim() || user?.email?.split('@')[0] || 'Guest'
  const email = user?.email?.trim() || (isLoggedIn ? '—' : 'Sign in')
  const initials = getInitials(user)

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5">
        {/* LEFT: sidebar toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-blue-400/50 hover:text-white"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
              <line x1="6" y1="2.5" x2="6" y2="13.5" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[#4d6bfe] text-sm font-bold text-white">
              A
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
              AI Video Studio
            </span>
          </Link>
        </div>

        {/* CENTER: nav */}
        <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          <Link href="/generate" className="transition hover:text-cyan-300">
            Studio
          </Link>
          <Link href="/project" className="transition hover:text-cyan-300">
            Projects
          </Link>
          <Link href="/account" className="transition hover:text-cyan-300">
            Account
          </Link>
        </nav>

        {/* RIGHT: notifications + user chip */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-cyan-400/50 hover:text-white"
          >
            <span className="text-sm">🔔</span>
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#4d6bfe]" />
          </button>

          <Link
            href={isLoggedIn ? '/account' : '/login'}
            data-tour="account"
            aria-label={isLoggedIn ? `Signed in as ${displayName}` : 'Sign in'}
            className="flex min-w-0 max-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 transition hover:border-cyan-400/50"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#4d6bfe]/15 text-[11px] font-semibold text-[#8aa0ff]">
              {initials}
            </span>

            <div className="min-w-0 text-left leading-tight">
              <p
                className="truncate text-xs font-semibold text-white"
                title={displayName}
              >
                {displayName}
              </p>
              <p className="truncate text-[10px] text-white/55" title={email}>
                {email}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ============================================================================
 * SECTION 3 — LeftSidebar.tsx
 * Collapsible navigation rail with projects, generation modes, and CTA.
 * ==========================================================================*/

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

export function LeftSidebar() {
  const router = useRouter()

  const { open, setOpen } = useSidebar()
  const { currentProjectId } = useCurrentProject()

  const closeMobileSidebar = useCallback(() => {
    setOpen(false)
  }, [setOpen])

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
     * No project is selected. Prevent direct navigation and
     * first determine whether the user already has projects.
     */
    event.preventDefault()

    const params = new URLSearchParams({ next: href, mode: label })

    try {
      const response = await fetch('/api/projects', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }

      const projects = await response.json()
      const hasProjects = Array.isArray(projects) && projects.length > 0

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

            <nav aria-label="Generation modes" className="grid gap-1">
              {MODES.map((mode) => (
                <Link
                  key={mode.id}
                  href={mode.href}
                  onClick={(event) =>
                    handleModeClick(event, mode.href, mode.label)
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

/* ============================================================================
 * SECTION 4 — Main.tsx
 * Chat surface with streaming messages and a resizing composer.
 * ==========================================================================*/

const SUGGESTIONS = [
  'Write a product launch tweet',
  'Summarize this article',
  'Draft a cold email',
  'Explain quantum computing simply',
]

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
      <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  )
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function Main() {
  const { messages, isStreaming, send } = useAgnes()

  const [input, setInput] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to the latest message as content changes.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isStreaming])

  // Focus the composer when the chat mounts.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Resize the composer based on its content.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [input])

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      send(trimmed)
      setInput('')
    },
    [isStreaming, send],
  )

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const visibleMessages = messages.filter((message) => message.role !== 'system')
  const showSuggestions = visibleMessages.length === 0

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#08090d] text-white">
      {/* Chat header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
            <SparkleIcon />
          </span>

          <div>
            <h1 className="text-sm font-semibold text-white">Agnes</h1>
            <p className="text-[10px] text-white/40">AI Assistant</p>
          </div>
        </div>

        <span className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-1.5 text-[10px] font-medium text-emerald-300/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Ready to help
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        aria-label="Chat messages"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6 sm:py-10"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {visibleMessages.length === 0 && (
            <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
              <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/15 to-blue-500/[0.04] text-indigo-300 shadow-lg shadow-indigo-500/[0.05]">
                <span className="scale-150">
                  <SparkleIcon />
                </span>
              </div>

              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                What can I help you create?
              </h2>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/45">
                Hi, I&apos;m Agnes. Ask a question, explore an idea,
                or tell me what you want to create.
              </p>
            </div>
          )}

          {visibleMessages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}

          {isStreaming &&
            visibleMessages[visibleMessages.length - 1]?.content === '' && (
              <div
                className="flex items-center gap-3 pl-1"
                role="status"
                aria-label="Agnes is responding"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
                  <SparkleIcon />
                </span>

                <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <Dot />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#08090d] px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          {showSuggestions && (
            <div className="mb-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  disabled={isStreaming}
                  className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-xs text-white/60 transition hover:border-indigo-400/30 hover:bg-indigo-500/[0.06] hover:text-white disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div
            data-tour="chat-input"
            className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-3 transition focus-within:border-indigo-400/40 focus-within:bg-white/[0.035] focus-within:ring-1 focus-within:ring-indigo-400/10"
          >
            <div className="flex items-end gap-3">
              <span className="mb-1.5 shrink-0 text-indigo-300/70">
                <SparkleIcon />
              </span>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message Agnes..."
                aria-label="Message Agnes"
                className="max-h-[200px] min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/30"
              />

              <button
                type="button"
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/15 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-white/30">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </main>
  )
}

/* ---------- Message components ---------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-2xl rounded-br-md border border-indigo-400/10 bg-indigo-500 px-4 py-3 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/[0.06] sm:max-w-[80%]">
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
        <SparkleIcon />
      </span>

      <div className="min-w-0 max-w-[90%] pt-1 text-sm leading-7 text-white/85 sm:max-w-[85%]">
        <p className="whitespace-pre-wrap break-words">
          {message.content || '\u00A0'}
        </p>
      </div>
    </div>
  )
}

function Dot({ delay = '0ms' }: { delay?: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300/70"
      style={{ animationDelay: delay }}
    />
  )
}

/* ============================================================================
 * SECTION 5 — AppShell (composition example)
 * Wire everything together inside the provider.
 * ==========================================================================*/

export function AppShell({
  user,
  children,
}: {
  user: TopBarUser | null
  children?: ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col bg-[#08090d] text-white">
        <TopBar user={user} />

        <div className="flex min-h-0 flex-1">
          <LeftSidebar />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {children ?? <Main />}
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}

/* ============================================================================
 * SECTION 6 — HomeClient.tsx
 * Default page component. Wraps the shell in SidebarProvider and
 * forwards an optional user to TopBar.
 * ==========================================================================*/

export default function HomeClient({
  user = null,
}: {
  user?: TopBarUser | null
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen flex-col bg-black text-white">
        <TopBar user={user} />

        <div className="flex min-h-0 flex-1">
          <LeftSidebar />
          <Main />
        </div>
      </div>
    </SidebarProvider>
  )
}