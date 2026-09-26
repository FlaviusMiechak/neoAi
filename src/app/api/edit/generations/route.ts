// src/app/api/generations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/auth'
import { getProject } from '@/lib/projects'
import type { GenerationMode } from '@/lib/generation-types'
import { randomUUID } from 'crypto'

const ALLOWED_MODES: readonly GenerationMode[] = [
  'text',
  'image',
  'audio',
  'video',
  'chat',
]

// ─────────────────────────────────────────────────────────────
// POST /api/generations
//
// Body:
//   {
//     projectId: string,
//     mode: GenerationMode,
//     prompt: string,
//     result: string,               // URL or data URL
//     metadata?: Record<string, any> // free-form; parentGenerationId goes here
//   }
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectId, mode, prompt, result, metadata } = body

  // ── Validation ─────────────────────────────────────────────
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  if (!mode || !ALLOWED_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${ALLOWED_MODES.join(', ')}` },
      { status: 400 }
    )
  }

  if (!result || typeof result !== 'string') {
    return NextResponse.json({ error: 'result required' }, { status: 400 })
  }

  // ── Ownership check ────────────────────────────────────────
  const project = await getProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // ── Insert ─────────────────────────────────────────────────
  const id = randomUUID()
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('generations')
    .insert({
      id,
      project_id: projectId,
      mode,
      prompt: (prompt ?? '').toString(),
      result,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: now,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[generations POST] insert error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Insert failed' },
      { status: 500 }
    )
  }

  // ── Touch project updated_at ───────────────────────────────
  await supabaseAdmin
    .from('projects')
    .update({ updated_at: now })
    .eq('id', projectId)
    .eq('user_id', userId)

  return NextResponse.json(data, { status: 201 })
}