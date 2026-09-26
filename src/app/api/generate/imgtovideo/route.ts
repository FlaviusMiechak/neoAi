// In src/app/api/generate/route.ts, inside if (action === 'create'):

// src/app/api/generate/imgtovideo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/projects'
import {
  addGeneration,
  generationExistsByVideoId,
} from '@/lib/generation'
import { getUserIdFromRequest } from '@/lib/auth'

const AGNES_BASE = 'https://apihub.agnes-ai.com'

function buildCharacterCastPrompt(
  basePrompt: string,
  characterProfile?: {
    enabled?: boolean
    role?: 'any' | 'actor' | 'actress'
    ethnicities?: string[]
    notes?: string
  }
) {
  if (!basePrompt || !characterProfile?.enabled) return basePrompt

  const roleText =
    characterProfile.role === 'actor'
      ? 'male actor'
      : characterProfile.role === 'actress'
        ? 'female actress'
        : 'character'

  const selectedEthnicities = (characterProfile.ethnicities ?? []).filter(Boolean)
  const ethnicityText =
    selectedEthnicities.length > 0
      ? selectedEthnicities.join(', ')
      : 'any appearance that fits the scene'

  const noteText = (characterProfile.notes ?? '').trim()
  const castNote = noteText
    ? ` ${noteText}`
    : ' Keep the cast flexible and only include these traits when they naturally fit the story.'

  return `${basePrompt}\n\nCharacter casting: ${roleText} with appearance options: ${ethnicityText}.${castNote}`
}

// ─────────────────────────────────────────────────────────────
// POST /api/generate/imgtovideo
//
// Body:
//   { projectId: string, imageUrl: string, prompt: string,
//     height?: number, width?: number,
//     num_frames?: number, frame_rate?: number,
//     videoId?: string }        // if present → status check instead of create
//
// Behavior:
//   - If body has `videoId`, checks the status of that task.
//   - Otherwise, creates a new image-to-video task.
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Body ──────────────────────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    action,
    projectId,
    image,
    imageUrl,
    prompt,
    videoId,
    height = 1280,
    width = 720,
    num_frames = 121,
    frame_rate = 24,
    characterProfile,
  } = body

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // ── Ownership check ───────────────────────────────────────
  const project = await getProject(userId, projectId)
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found or not owned by user' },
      { status: 403 }
    )
  }

  const auth = {
    Authorization: `Bearer ${process.env.AGNES_API_KEY}`,
    'Content-Type': 'application/json',
  }

  const referenceImage = image ?? imageUrl ?? body.image_url

  // ─────────────────────────────────────────────────────────
  // STATUS CHECK
  // ─────────────────────────────────────────────────────────
  if (action === 'status' || videoId) {
    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 })
    }

    const url = new URL(`${AGNES_BASE}/agnesapi`)
    url.searchParams.set('video_id', videoId)
    url.searchParams.set('model_name', 'agnes-video-v2.0')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.AGNES_API_KEY}` },
    })
    const data = await res.json()

    const finalUrl =
      data.metadata?.url ?? data.url ?? data.video_url ?? data.output?.url ?? ''

    const rawStatus = String(data.status ?? '').toLowerCase()
    const isDone =
      rawStatus === 'completed' ||
      rawStatus === 'succeeded' ||
      rawStatus === 'success'
    const isFailed =
      rawStatus === 'failed' ||
      rawStatus === 'error' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'canceled'

    if (isDone && finalUrl) {
      const alreadySaved = await generationExistsByVideoId(projectId, videoId)
      if (!alreadySaved) {
        await addGeneration(userId, projectId, {
          mode: 'video',
          prompt: prompt || '',
          result: finalUrl,
          metadata: {
            model: 'agnes-video-v2.0',
            videoId,
            status: 'completed',
            source: 'imgtovideo',
            referenceImage: referenceImage || null,
          },
        })
      }
      return NextResponse.json({
        status: 'completed',
        url: finalUrl,
        videoId,
        raw: data,
      })
    }

    if (isFailed) {
      return NextResponse.json({
        status: 'failed',
        error: data.error ?? data.message ?? rawStatus,
        raw: data,
      })
    }

    return NextResponse.json({
      status: 'processing',
      progress: data.progress ?? data.internal_progress ?? null,
      videoId,
      raw: data,
    })
  }

  // ─────────────────────────────────────────────────────────
  // CREATE NEW TASK
  // ─────────────────────────────────────────────────────────
  if (!referenceImage) {
    return NextResponse.json(
      { error: 'image required for image-to-video' },
      { status: 400 }
    )
  }
  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  const finalPrompt = buildCharacterCastPrompt(prompt.trim(), characterProfile)

  const res = await fetch(`${AGNES_BASE}/v1/videos`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt: finalPrompt,
      image: referenceImage,
      mode: 'ti2vid',
      height,
      width,
      num_frames,
      frame_rate,
    }),
  })

  const raw = await res.text()
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'Agnes returned non-JSON', status: res.status, body: raw },
      { status: 502 }
    )
  }

  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status })
  }

  const extractedVideoId =
    data.video_id ?? data.id ?? data.task_id ?? data.videoId

  if (!extractedVideoId) {
    return NextResponse.json(
      { error: 'No videoId in Agnes response', raw: data },
      { status: 502 }
    )
  }

  return NextResponse.json({
    videoId: extractedVideoId,
    status: data.status ?? 'processing',
    progress: data.progress ?? 0,
  })
}