// src/app/api/projects/[projectId]/assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/auth'
import { getProject } from '@/lib/projects'
import type { Generation } from '@/lib/generation-types'

// ─────────────────────────────────────────────────────────────
// GET /api/projects/[projectId]/assets
//
// Query params (optional):
//   ?mode=video|image|audio|text|chat    filter to a single mode
//
// Response:
//   {
//     all: Generation[],
//     byMode: { video: [], image: [], audio: [], text: [], chat: [] },
//     counts: { video: n, image: n, audio: n, text: n, chat: n }
//   }
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await getProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const modeFilter = request.nextUrl.searchParams.get('mode')

  let query = supabaseAdmin
    .from('generations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (modeFilter) {
    query = query.eq('mode', modeFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[assets GET] query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const all = (data ?? []) as Generation[]

  const byMode = {
    video: all.filter((g) => g.mode === 'video'),
    image: all.filter((g) => g.mode === 'image'),
    audio: all.filter((g) => g.mode === 'audio'),
    text: all.filter((g) => g.mode === 'text'),
    chat: all.filter((g) => g.mode === 'chat'),
  }

  const counts = {
    video: byMode.video.length,
    image: byMode.image.length,
    audio: byMode.audio.length,
    text: byMode.text.length,
    chat: byMode.chat.length,
  }

  return NextResponse.json({ all, byMode, counts })
}