// app/generate/layout.tsx  (server component — no 'use client')
import TopBar from '@/components/jTopBar'
import LeftSidebar from '@/components/LeftSidebar'
import { getCurrentUser } from '@/lib/auth'

export default async function GenerateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <TopBar
        user={
          user
            ? { id: user.id, email: user.email, name: user.name }
            : null
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1">
        <LeftSidebar
          user={
            user
              ? { id: user.id, email: user.email, name: user.name }
              : null
          }
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}