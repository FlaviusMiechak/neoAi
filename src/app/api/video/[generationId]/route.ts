// src/app/api/video/[generationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params

  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Load the generation, scoped to projects owned by this user
  const { data: genRows, error: genErr } = await supabaseAdmin
    .from('generations')
    .select('id, prompt, result, metadata, project_id, projects!inner(user_id)')
    .eq('id', generationId)
    .eq('projects.user_id', userId)
    .limit(1)

  if (genErr || !genRows?.[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const gen = genRows[0] as any

  // 2. Load any edit timeline
  const { data: editRows } = await supabaseAdmin
    .from('edits')
    .select('timeline')
    .eq('generation_id', generationId)
    .limit(1)

  let duration: number | undefined
  if (gen.metadata) {
    try {
      duration = JSON.parse(gen.metadata).duration
    } catch {
      duration = undefined
    }
  }

  let timeline: any = null
  if (editRows?.[0]?.timeline) {
    timeline =
      typeof editRows[0].timeline === 'string'
        ? JSON.parse(editRows[0].timeline)
        : editRows[0].timeline
  }

  return NextResponse.json({
    id: gen.id,
    prompt: gen.prompt,
    url: gen.result,
    duration,
    timeline,
  })
}