// components/TopBar.tsx
'use client'

import Link from 'next/link'
import { useSidebar } from '@/components/SidebarContext'

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

export default function TopBar({ user }: { user: TopBarUser | null }) {
  const { open, toggle } = useSidebar()

  const isLoggedIn = Boolean(user)
  const displayName =
    user?.name?.trim() ||
    user?.email?.split('@')[0] ||
    'Guest'
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

            {/* Always visible now — no `hidden sm:block` */}
            <div className="min-w-0 text-left leading-tight">
              <p
                className="truncate text-xs font-semibold text-white"
                title={displayName}
              >
                {displayName}
              </p>
              <p
                className="truncate text-[10px] text-white/55"
                title={email}
              >
                {email}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}