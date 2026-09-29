// app/page.tsx
import { redirect } from 'next/navigation'
import HomeClient from './HomeClient'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login?next=%2F')
  }

  /*
   * `getCurrentUser()` may return a richer user object than the
   * minimal shape TopBar needs. Pass only what the client uses
   * so the RSC → client boundary stays lean and serializable.
   */
  return (
    <HomeClient
      user={{
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
      }}
    />
  )
}