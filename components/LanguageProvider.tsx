'use client'

import { createContext, useContext } from 'react'

interface LanguageContextValue {
  language: string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
})

export function LanguageProvider({
  children,
  initialLanguage = 'en',
}: {
  children: React.ReactNode
  initialLanguage?: string
}) {
  return (
    <LanguageContext.Provider value={{ language: initialLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}