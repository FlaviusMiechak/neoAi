// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
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
  // speed: 0.5..2 → '+/-N%'  (Edge accepts e.g. '+50%' or '-25%')
  if (!speed || speed === 1) return '+0%'
  const pct = Math.round((speed - 1) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

function toPitchHz(pitch: number | undefined): string {
  // pitch: -12..12 semitones → roughly '+/-NHz'
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
    duration,
    style,
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

    // ── Persist ────────────────────────────────────────────
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
        duration: duration ?? null,
        style: style ?? null,
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
  // VIDEO: CREATE
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
    const dimensionsByAspect: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1152, height: 648 },
      '9:16': { width: 648, height: 1152 },
      '1:1': { width: 1024, height: 1024 },
      '21:9': { width: 1260, height: 540 },
    }
    const dimensions = dimensionsByAspect[aspect] ?? dimensionsByAspect['16:9']
    const frameRate = 10
    const videoDuration = Number.isFinite(Number(duration))
      ? Math.min(16, Math.max(2, Number(duration)))
      : 6

    const res = await fetch(`${AGNES_BASE}/v1/videos`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        model: model || 'agnes-video-v2.0',
        prompt: finalPrompt,
        ...(referenceImage ? { image: referenceImage, mode: 'ti2vid' } : {}),
        ...dimensions,
        num_frames: videoDuration * frameRate,
        frame_rate: frameRate,
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
  // VIDEO: STATUS
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

  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 }
  )
}