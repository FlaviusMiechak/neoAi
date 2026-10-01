import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/admin'
import AdminUsersPanel from './AdminUsersPanel';

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login?next=%2Fadmin')
  }

  if (!(await isAdmin(user.id))) {
    notFound()
  }

  return <AdminUsersPanel currentUserId={user.id} />
}