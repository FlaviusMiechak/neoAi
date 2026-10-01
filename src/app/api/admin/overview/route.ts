import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [usersResult, projectsResult, generationsResult, editsResult] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, email, name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('projects')
      .select('id, user_id, name, description, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('generations')
      .select('id, project_id, mode, prompt, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('edits')
      .select('generation_id, timeline', { count: 'exact' })
      .limit(200),
  ])

  const failedQuery = [usersResult, projectsResult, generationsResult, editsResult]
    .find((result) => result.error)

  if (failedQuery?.error) {
    console.error('[admin/overview] query failed:', failedQuery.error.message)
    return NextResponse.json({ error: 'Failed to load admin activity' }, { status: 500 })
  }

  return NextResponse.json({
    counts: {
      users: usersResult.count ?? 0,
      projects: projectsResult.count ?? 0,
      generations: generationsResult.count ?? 0,
      edits: editsResult.count ?? 0,
    },
    users: usersResult.data ?? [],
    projects: projectsResult.data ?? [],
    generations: generationsResult.data ?? [],
    edits: editsResult.data ?? [],
  })
}