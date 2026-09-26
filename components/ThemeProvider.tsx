'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [resolved, setResolved] = useState<ResolvedTheme>(
    initialTheme === 'system' ? 'dark' : initialTheme
  )

  // Apply the theme to <html> and persist to cookie
  const apply = useCallback((next: Theme) => {
    const system = getSystemTheme()
    const finalResolved: ResolvedTheme = next === 'system' ? system : next

    document.documentElement.classList.toggle('dark', finalResolved === 'dark')
    document.documentElement.style.colorScheme = finalResolved

    // Persist for the server to read on next load
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`

    setThemeState(next)
    setResolved(finalResolved)
  }, [])

  // On mount: apply whatever the initial theme was, and subscribe to OS changes
  useEffect(() => {
    apply(initialTheme)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') apply('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [apply, initialTheme, theme])

  const setTheme = useCallback((t: Theme) => apply(t), [apply])
  const toggle = useCallback(
    () => apply(resolved === 'dark' ? 'light' : 'dark'),
    [apply, resolved]
  )

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}