// src/app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LanguageProvider } from '@/components/LanguageProvider'

const ThemeProviderCompat = ThemeProvider as unknown as React.ElementType
const LanguageProviderCompat = LanguageProvider as unknown as React.ElementType

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AI Studio',
  description: 'Create AI-powered videos with ease',
  icons: {
    icon: [
      { url: '/public/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/public/apple-touch-icon.png',
    shortcut: '/public/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

async function detectLanguage(): Promise<string> {
  const h = await headers()
  const accept = h.get('accept-language') ?? 'fr'
  const first = accept.split(',')[0]?.split('-')[0]?.trim().toLowerCase()
  return first || 'en'
}

async function detectTheme(): Promise<'light' | 'dark' | 'system'> {
  const c = await cookies()
  const stored = c.get('theme')?.value
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [language, theme] = await Promise.all([
    detectLanguage(),
    detectTheme(),
  ])

  return (
    <html lang={language} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProviderCompat initialTheme={theme}>
          <LanguageProviderCompat initialLanguage={language}>
            {children}
          </LanguageProviderCompat>
        </ThemeProviderCompat>
      </body>
    </html>
  )
}