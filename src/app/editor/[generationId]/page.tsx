// src/app/editor/[generationId]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createElement } from 'react'
import { getUserIdFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import EditorWorkspace from './EditorWorkspace'

export const dynamic = 'force-dynamic'

export default async function EditorPage({
  params,
}: {
  params: Promise<{ generationId: string }>
}) {
  const { generationId } = await params

  const userId = await getUserIdFromRequest()
  if (!userId) redirect('/login')

  // Load the generation + its parent project (ownership check)
  const { data: genRows, error: genErr } = await supabaseAdmin
    .from('generations')
    .select('*, projects!inner(id, name, user_id)')
    .eq('id', generationId)
    .eq('projects.user_id', userId)
    .limit(1)

  if (genErr || !genRows?.[0]) notFound()
  const generation = genRows[0] as any

  // Load all other generations in the project (the asset library)
  const { data: assets } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('project_id', generation.project_id)
    .order('created_at', { ascending: false })

  // Load any existing edit timeline
  const { data: editRows } = await supabaseAdmin
    .from('edits')
    .select('timeline')
    .eq('generation_id', generationId)
    .limit(1)

  return createElement(EditorWorkspace, {
    initialGeneration: generation,
    initialAssets: assets ?? [],
    initialTimeline: editRows?.[0]?.timeline ?? null,
  })
}