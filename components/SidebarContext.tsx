
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

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
 * /generate/text
 * /generate/image
 * /generate/audio
 * /generate/video
 * /generate/chat
 *
 * An optional trailing slash is allowed.
 */
const MODE_ROUTE =
  /^\/generate\/(text|image|audio|video|chat)\/?$/

const STORAGE_KEY = 'sidebar:open'

export function SidebarProvider({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  const [open, setOpen] = useState(true)

  /*
   * Prevents the pathname effect from treating the initial
   * pathname as a navigation into a mode.
   */
  const previousPathname = useRef<string | null>(null)

  /*
   * Restore the user's sidebar preference after hydration.
   */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)

      if (saved === '1') {
        setOpen(true)
      } else if (saved === '0') {
        setOpen(false)
      }
    } catch {
      // localStorage may be unavailable.
      // Keep the default sidebar state.
    }
  }, [])

  /*
   * Persist sidebar state.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        open ? '1' : '0',
      )
    } catch {
      // Ignore storage errors.
    }
  }, [open])

  /*
   * Automatically close the sidebar only when the user
   * ENTERS a generation mode from a non-mode route.
   *
   * Example:
   *
   * /project
   *     ↓
   * /generate/video
   *
   * Sidebar closes.
   *
   * But:
   *
   * /generate/video
   *     ↓
   * /generate/image
   *
   * Sidebar state is left alone.
   */
  useEffect(() => {
    const previous = previousPathname.current

    previousPathname.current = pathname

    // Ignore the initial render.
    if (previous === null) {
      return
    }

    const wasModeRoute = MODE_ROUTE.test(previous)
    const isModeRoute = MODE_ROUTE.test(pathname)

    if (isModeRoute && !wasModeRoute) {
      setOpen(false)
    }
  }, [pathname])

  /*
   * Cmd+B / Ctrl+B sidebar shortcut.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isToggleShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'b'

      if (!isToggleShortcut) {
        return
      }

      event.preventDefault()

      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function toggle() {
    setOpen((current) => !current)
  }

  return (
    <SidebarContext.Provider
      value={{
        open,
        toggle,
        setOpen,
      }}
    >
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
