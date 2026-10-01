//app/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AccountCommunications from './AccountCommunications'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Faccount')

  return <AccountCommunications name={user.name ?? user.email} />
}