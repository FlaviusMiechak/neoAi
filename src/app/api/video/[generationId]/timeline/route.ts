// src/app/api/video/[generationId]/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/utils/supabase/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params     // ← MUST be awaited

  if (!generationId) {
    return NextResponse.json(
      { error: 'Missing generationId' },
      { status: 400 }
    )
  }

  const timeline = await request.json()

  await pool`
    INSERT INTO edits (generation_id, timeline)
    VALUES (${generationId}, ${JSON.stringify(timeline)})
    ON CONFLICT (generation_id)
    DO UPDATE SET timeline = EXCLUDED.timeline
  `

  return NextResponse.json({ ok: true })
}