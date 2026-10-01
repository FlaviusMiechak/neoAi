// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getProject } from '@/lib/projects'
import {
  addGeneration,
  generationExistsByVideoId,
} from '@/lib/generation'

import type { AudioSubMode } from '@/lib/generation-types'

import { getUserIdFromRequest } from '@/lib/auth'
import { EdgeTTS } from 'edge-tts-universal'
import { CHARACTER_PROFILES } from '@/lib/video-studio'

const AGNES_BASE = 'https://apihub.agnes-ai.com'

// ── Long-video constants ──────────────────────────────────
const TARGET_DURATION_SEC = 6 * 60  // 6 minutes
const CLIP_DURATION_SEC   = 18       // 441 frames @ 24 fps ≈ 18.4s

const DIMENSIONS_BY_ASPECT: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1152, height: 648 },
  '9:16': { width: 648,  height: 1152 },
  '1:1':  { width: 1024, height: 1024 },
  '21:9': { width: 1260, height: 540 },
}

function shotCountForTarget(targetSec = TARGET_DURATION_SEC) {
  return Math.max(1, Math.ceil(targetSec / CLIP_DURATION_SEC))
}

async function splitPromptIntoShots(
  basePrompt: string,
  shotCount: number,
  auth: Record<string, string>
): Promise<string[]> {
  try {
    const res = await fetch(`${AGNES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a storyboard writer. Split the user prompt into N sequential visual shots. ' +
              'Each shot must be a self-contained video-generation prompt (subject, action, camera, lighting). ' +
              'Return ONLY a JSON array of strings, no markdown, no commentary.',
          },
          {
            role: 'user',
            content: `Split into exactly ${shotCount} shots.\n\nPROMPT:\n${basePrompt}`,
          },
        ],
      }),
    })
    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()
    const arr = JSON.parse(cleaned)
    if (Array.isArray(arr) && arr.length) {
      return arr.slice(0, shotCount).map((s) => String(s))
    }
  } catch (err) {
    console.error('[create-long] shot split failed:', err)
  }
  // Fallback: repeat base prompt with shot suffixes
  return Array.from({ length: shotCount }, (_, i) =>
    `${basePrompt}\n\n(Shot ${i + 1} of ${shotCount}; continuous story, consistent characters and style.)`
  )
}

function buildCharacterCastPrompt(
  basePrompt: string,
  characterProfile?: {
    enabled?: boolean
    role?: 'any' | 'actor' | 'actress'
    characters?: { origin: string; name: string }[]
    notes?: string
  },
  style?: string,
  storyFormats?: string[],
  ingredients?: { kind: string; name: string }[]
) {
  const setup: string[] = []

  if (style) setup.push(`Visual style: ${style}.`)

  const formatGuidance: Record<string, string> = {
    Storyline: 'Use a coherent narrative progression with a clear beginning, development, and payoff.',
    Episode: 'Shape this as an episode with an engaging opening, a focused arc, and a satisfying beat.',
    Scene: 'Keep this as one focused, visually continuous scene.',
    Chapter: 'Treat this as a chapter in a continuing story and preserve continuity.',
    Tales: 'Use the imaginative, memorable tone of a tale without adding a moral unless requested.',
  }
  const selectedFormats = (storyFormats ?? []).filter((format) =>
    Object.hasOwn(formatGuidance, format)
  )
  if (selectedFormats.length) {
    setup.push(
      `Story structure (${selectedFormats.join(', ')}): ${selectedFormats
        .map((format) => formatGuidance[format])
        .join(' ')}`
    )
  }

  if (characterProfile?.enabled) {
    const roleText =
      characterProfile.role === 'actor'
        ? 'male-presenting character'
        : characterProfile.role === 'actress'
          ? 'female-presenting character'
          : 'character'
    const cast = (characterProfile.characters ?? []).flatMap((character, index) => {
      const profile = CHARACTER_PROFILES.find((option) => option.id === character.origin)
      if (!profile) return []
      const name = character.name.trim() || `Character ${index + 1}`
      return [`${name} is a distinct ${roleText} with ${profile.prompt}`]
    })

    if (cast.length) {
      setup.push(
        `Distinct recurring cast: ${cast.join(' ')} Keep each selected character visually consistent and separate throughout the video.`
      )
    }

    const notes = characterProfile.notes?.trim()
    if (notes) setup.push(`Character direction: ${notes}`)
  }

  if (ingredients?.length) {
    const descriptions = ingredients.map(
      (ingredient) => `${ingredient.kind}: ${ingredient.name}`
    )
    setup.push(
      `Project library and uploaded reference assets: ${descriptions.join('; ')}. Use these as visual or story context where appropriate.`
    )
  }

  return [basePrompt, ...setup].filter(Boolean).join('\n\n')
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────
  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Body ────────────────────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    action,
    prompt,
    videoId,
    model,
    messages,
    projectId,
    voice,
    characterProfile,
    style,
    storyFormats,
    ingredients,
    aspect,
    duration,
  } = body

  // ── 3. Project required ────────────────────────────────────
  if (!projectId) {
    return NextResponse.json(
      { error: 'A project is required before generating.' },
      { status: 400 }
    )
  }

  const project = await getProject(userId, projectId)
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found or not owned by user.' },
      { status: 403 }
    )
  }

  const auth = {
    Authorization: `Bearer ${process.env.AGNES_API_KEY}`,
    'Content-Type': 'application/json',
  }

  // ────────────────────────────────────────────────────────────
  // TEXT
  // ────────────────────────────────────────────────────────────
  if (action === 'text') {
    const res = await fetch(`${AGNES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })

    const text = data.choices?.[0]?.message?.content ?? ''

    await addGeneration(userId, projectId, {
      mode: 'text',
      prompt,
      result: text,
      metadata: { model: 'agnes-2.0-flash' },
    })

    return NextResponse.json({ text })
  }

  // ────────────────────────────────────────────────────────────
  // IMAGE
  // ────────────────────────────────────────────────────────────
  if (action === 'image') {
    const res = await fetch(`${AGNES_BASE}/v1/images/generations`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: 'agnes-image-2.1-flash',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    })

    const raw = await res.text()
    console.log('[image] Agnes status:', res.status)
    console.log('[image] Agnes body:', raw)

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

    const rawUrl = data.data?.[0]?.url ?? data.url ?? data.image_url ?? ''
    const b64 = data.data?.[0]?.b64_json ?? data.b64_json ?? ''
    const url = rawUrl || (b64 ? `data:image/png;base64,${b64}` : '')

    console.log('[image] extracted url:', url ? url.slice(0, 80) : '(empty)')

    if (!url) {
      return NextResponse.json(
        { error: 'No image in Agnes response', raw: data },
        { status: 502 }
      )
    }

    await addGeneration(userId, projectId, {
      mode: 'image',
      prompt,
      result: url,
      metadata: { model: 'agnes-image-2.1-flash' },
    })

    return NextResponse.json({ url })
  }

  // ────────────────────────────────────────────────────────────
  // CHAT
  // ────────────────────────────────────────────────────────────
  if (action === 'chat') {
    const res = await fetch(`${AGNES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ model: 'agnes-2.0-flash', messages }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })

    const reply = data.choices?.[0]?.message?.content ?? ''
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')

    await addGeneration(userId, projectId, {
      mode: 'chat',
      prompt: lastUser?.content ?? '',
      result: reply,
      metadata: { model: 'agnes-2.0-flash' },
    })

    return NextResponse.json({ reply })
  }

  // Voice map — extend as needed. Key = client `voice` id, value = Edge voice name.
  const EDGE_VOICE_MAP: Record<string, string> = {
    aria: 'en-US-AriaNeural',
    atlas: 'en-US-GuyNeural',
    nova: 'en-US-JennyNeural',
    orion: 'en-US-DavisNeural',
    luna: 'en-US-MichelleNeural',
    echo: 'en-US-EricNeural',
  }

  // Language map → default voice per language (used when voice is generic)
  const EDGE_LANG_DEFAULT: Record<string, string> = {
    'English (US)': 'en-US-AriaNeural',
    'English (UK)': 'en-GB-SoniaNeural',
    Spanish: 'es-ES-ElviraNeural',
    French: 'fr-FR-DeniseNeural',
    German: 'de-DE-KatjaNeural',
    Italian: 'it-IT-ElsaNeural',
    Portuguese: 'pt-BR-FranciscaNeural',
    Japanese: 'ja-JP-NanamiNeural',
    Korean: 'ko-KR-SunHiNeural',
    Mandarin: 'zh-CN-XiaoxiaoNeural',
    Hindi: 'hi-IN-SwaraNeural',
    Arabic: 'ar-SA-ZariyahNeural',
    Russian: 'ru-RU-SvetlanaNeural',
  }

  function resolveEdgeVoice(
    voiceId: string | undefined,
    language: string | undefined
  ): string {
    if (voiceId && EDGE_VOICE_MAP[voiceId]) return EDGE_VOICE_MAP[voiceId]
    if (language && EDGE_LANG_DEFAULT[language]) return EDGE_LANG_DEFAULT[language]
    return 'en-US-AriaNeural'
  }

  function toRatePercent(speed: number | undefined): string {
    if (!speed || speed === 1) return '+0%'
    const pct = Math.round((speed - 1) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  function toPitchHz(pitch: number | undefined): string {
    if (!pitch) return '+0Hz'
    const hz = Math.round(pitch * 5)
    return `${hz >= 0 ? '+' : ''}${hz}Hz`
  }

  // ────────────────────────────────────────────────────────────
  // AUDIO (Edge TTS, sub-mode aware)
  // ────────────────────────────────────────────────────────────
  if (action === 'audio') {
    const {
      mode: subMode = 'tts',
      language,
      speed,
      pitch,
      stability,
      duration: audioDuration,
      style: audioStyle,
      loop,
    } = body as {
      mode?: AudioSubMode
      language?: string
      speed?: number
      pitch?: number
      stability?: number
      duration?: number
      style?: string
      loop?: boolean
    }

    // voice-clone requires a reference upload
    let referenceFile: File | null = null
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const ref = form.get('reference')
      if (ref instanceof File) referenceFile = ref
    }

    if (subMode === 'voice-clone' && !referenceFile) {
      return NextResponse.json(
        { error: 'Voice clone requires a reference audio file.' },
        { status: 400 }
      )
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt (text to speak) is required.' },
        { status: 400 }
      )
    }

    try {
      const edgeVoice = resolveEdgeVoice(voice, language)

      const tts = new EdgeTTS(prompt, edgeVoice, {
        rate: toRatePercent(speed),
        volume: '+0%',
        pitch: toPitchHz(pitch),
      })

      const result = await tts.synthesize()

      const rawAudio: any =
        (result as any).audio ?? (result as any).data ?? result
      const buffer = Buffer.isBuffer(rawAudio)
        ? rawAudio
        : rawAudio?.arrayBuffer
          ? Buffer.from(await rawAudio.arrayBuffer())
          : Buffer.from(rawAudio)

      const base64 = buffer.toString('base64')
      const dataUrl = `data:audio/mp3;base64,${base64}`

      await addGeneration(userId, projectId, {
        mode: 'audio',
        prompt,
        result: dataUrl,
        metadata: {
          provider: 'edge-tts',
          submode: subMode,
          voice: edgeVoice,
          language: language ?? null,
          speed: speed ?? 1,
          pitch: pitch ?? 0,
          stability: stability ?? null,
          duration: audioDuration ?? null,
          style: audioStyle ?? null,
          loop: loop ?? false,
          hasReference: !!referenceFile,
        },
      })

      return NextResponse.json({
        url: dataUrl,
        projectId,
        mode: subMode,
        voice: edgeVoice,
      })
    } catch (err: any) {
      console.error('[audio] Edge TTS error:', err)
      return NextResponse.json(
        { error: err?.message || 'Audio synthesis failed' },
        { status: 500 }
      )
    }
  }

  // ────────────────────────────────────────────────────────────
  // VIDEO: CREATE (single clip)
  // ────────────────────────────────────────────────────────────
  if (action === 'create') {
    const selectedIngredients = Array.isArray(ingredients)
      ? ingredients.filter(
          (item: any) =>
            item &&
            typeof item.kind === 'string' &&
            typeof item.name === 'string' &&
            typeof item.url === 'string'
        )
      : []
    const finalPrompt = buildCharacterCastPrompt(
      prompt,
      characterProfile,
      style,
      storyFormats,
      selectedIngredients
    )
    const referenceImage = selectedIngredients.find(
      (item: any) => item.kind === 'image'
    )?.url
    const dimensions = DIMENSIONS_BY_ASPECT[aspect] ?? DIMENSIONS_BY_ASPECT['16:9']

    const res = await fetch(`${AGNES_BASE}/v1/videos`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: model || 'agnes-video-v2.0',
        prompt: finalPrompt,
        ...(referenceImage ? { image: referenceImage, mode: 'ti2vid' } : {}),
        ...dimensions,
        num_frames: 441,
        frame_rate: 24,
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })

    const extractedVideoId =
      data.video_id ?? data.id ?? data.task_id ?? data.videoId

    return NextResponse.json({
      videoId: extractedVideoId,
      status: data.status,
      progress: data.progress,
      prompt: finalPrompt,
    })
  }

  // ────────────────────────────────────────────────────────────
  // VIDEO: CREATE-LONG (batch of clips for long-form)
  // ────────────────────────────────────────────────────────────
  if (action === 'create-long') {
    const targetSec = Number(duration) || TARGET_DURATION_SEC
    const shotCount = shotCountForTarget(targetSec)

    const finalPrompt = buildCharacterCastPrompt(
      prompt,
      characterProfile,
      style,
      storyFormats,
      ingredients
    )

    const shots = await splitPromptIntoShots(finalPrompt, shotCount, auth)

    const dimensions = DIMENSIONS_BY_ASPECT[aspect] ?? DIMENSIONS_BY_ASPECT['16:9']

    // Fire off all clips in parallel
    const jobs = await Promise.all(
      shots.map(async (shotPrompt, i) => {
        try {
          const res = await fetch(`${AGNES_BASE}/v1/videos`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({
              model: model || 'agnes-video-v2.0',
              prompt: shotPrompt,
              ...dimensions,
              num_frames: 441,
              frame_rate: 24,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { index: i, error: data, prompt: shotPrompt }
          }
          const id = data.video_id ?? data.id ?? data.task_id ?? data.videoId
          return { index: i, videoId: id, prompt: shotPrompt }
        } catch (err: any) {
          return { index: i, error: err?.message ?? 'request failed', prompt: shotPrompt }
        }
      })
    )

    const batchId = randomUUID()

    await addGeneration(userId, projectId, {
      mode: 'video-batch',
      prompt: finalPrompt,
      result: batchId,
      metadata: {
        batchId,
        targetSec,
        shotCount,
        jobs,
        aspect: aspect ?? '16:9',
        model: model || 'agnes-video-v2.0',
        status: 'processing',
      },
    })

    return NextResponse.json({
      batchId,
      jobs,
      targetSec,
      shotCount,
      clipDurationSec: CLIP_DURATION_SEC,
    })
  }

  // ────────────────────────────────────────────────────────────
  // VIDEO: STATUS (single clip)
  // ────────────────────────────────────────────────────────────
  if (action === 'status') {
    const url = new URL(`${AGNES_BASE}/agnesapi`)
    url.searchParams.set('video_id', videoId)
    if (model) url.searchParams.set('model_name', model)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.AGNES_API_KEY}` },
    })
    const data = await res.json()

    console.log('[video status]', videoId, '→', res.status, JSON.stringify(data))

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
            model: model || 'agnes-video-v2.0',
            videoId,
            status: 'completed',
            style: style ?? null,
            storyFormats: storyFormats ?? [],
            aspect: aspect ?? null,
            duration: duration ?? null,
            characterProfile: characterProfile ?? null,
            ingredients: Array.isArray(ingredients)
              ? ingredients.map(({ kind, name, generationId }: any) => ({
                  kind,
                  name,
                  generationId,
                }))
              : [],
          },
        })
      }

      return NextResponse.json({
        status: 'completed',
        url: finalUrl,
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
      progress: data.progress ?? null,
      raw: data,
    })
  }

  // ────────────────────────────────────────────────────────────
  // VIDEO: BATCH-STATUS (poll all clips in a long-form batch)
  // ────────────────────────────────────────────────────────────
  if (action === 'batch-status') {
    const { batchId } = body
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
    }

    const { getGenerationByBatchId } = await import('@/lib/generation')
    const batch = await getGenerationByBatchId(projectId, batchId)
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const metadata = typeof batch.metadata === 'string'
      ? JSON.parse(batch.metadata)
      : batch.metadata
    const jobs = (metadata?.jobs ?? []) as {
      index: number
      videoId?: string
      error?: any
    }[]

    const results = await Promise.all(
      jobs.map(async (job) => {
        if (!job.videoId) {
          return { index: job.index, status: 'failed', error: job.error ?? 'no videoId' }
        }
        const url = new URL(`${AGNES_BASE}/agnesapi`)
        url.searchParams.set('video_id', job.videoId)
        url.searchParams.set('model_name', metadata?.model || 'agnes-video-v2.0')
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${process.env.AGNES_API_KEY}` },
        })
        const data = await res.json()
        const finalUrl =
          data.metadata?.url ?? data.url ?? data.video_url ?? data.output?.url ?? ''
        const status = String(data.status ?? '').toLowerCase()
        return { index: job.index, url: finalUrl, status, raw: data }
      })
    )

    const isDone = (s: string) =>
      s === 'completed' || s === 'succeeded' || s === 'success'
    const isFailed = (s: string) =>
      s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled'

    const completed = results.filter((r) => isDone(r.status) && r.url)
    const failed = results.filter((r) => isFailed(r.status) || (!r.url && isDone(r.status)))

    if (failed.length) {
      return NextResponse.json({
        status: 'failed',
        failed,
        completed: completed.length,
        total: results.length,
      })
    }

    if (completed.length === results.length) {
      return NextResponse.json({
        status: 'clips-ready',
        clips: results.sort((a, b) => a.index - b.index).map((r) => r.url),
        total: results.length,
      })
    }

    return NextResponse.json({
      status: 'processing',
      progress: completed.length / results.length,
      completed: completed.length,
      total: results.length,
      results,
    })
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 }
  )
}