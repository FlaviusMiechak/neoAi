// src/app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LanguageProvider } from '@/components/LanguageProvider'
import { SidebarProvider } from '@/components/SidebarContext'
import { AgnesProvider } from '@/components/AgnesProvider'

const ThemeProviderCompat = ThemeProvider as unknown as React.ElementType
const LanguageProviderCompat = LanguageProvider as unknown as React.ElementType

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'AI Studio',
  description: 'Create AI-powered videos with ease',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const language = (h.get('accept-language') ?? 'fr').split(',')[0]?.split('-')[0] ?? 'en'
  const theme = 'dark' as const

  return (
    <html lang={language} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProviderCompat initialTheme={theme}>
          <LanguageProviderCompat initialLanguage={language}>
            <SidebarProvider>
              <AgnesProvider>
                {children}
              </AgnesProvider>
            </SidebarProvider>
          </LanguageProviderCompat>
        </ThemeProviderCompat>
      </body>
    </html>
  )
}