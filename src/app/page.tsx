import { redirect } from 'next/navigation'
import HomeClient from './HomeClient'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login?next=%2F')
  }

  return <HomeClient />
}