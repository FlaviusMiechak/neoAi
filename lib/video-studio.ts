// src/lib/video-studio.ts
import type { Generation } from '@/lib/useCurrentProject'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AssetKind = 'image' | 'video' | 'audio' | 'text'
export type SourceKind = 'upload' | 'project'
export type CharacterOrigin =
  | 'black-african'
  | 'chinese'
  | 'japanese'
  | 'american'

export interface StoryCharacter {
  origin: CharacterOrigin
  name: string
}

export const CHARACTER_PROFILES = [
  {
    id: 'black-african',
    label: 'Black African',
    prompt: 'Black African heritage; portray as an individual, not a stereotype.',
    tone: 'from-amber-500/30 to-rose-700/40',
  },
  {
    id: 'chinese',
    label: 'Chinese',
    prompt: 'Chinese heritage; portray as an individual, not a stereotype.',
    tone: 'from-red-500/30 to-amber-700/40',
  },
  {
    id: 'japanese',
    label: 'Japanese',
    prompt: 'Japanese heritage; portray as an individual, not a stereotype.',
    tone: 'from-pink-500/30 to-slate-600/40',
  },
  {
    id: 'american',
    label: 'American',
    prompt: 'American background; appearance is not restricted to one ethnicity.',
    tone: 'from-blue-500/30 to-red-700/40',
  },
] as const satisfies readonly {
  id: CharacterOrigin
  label: string
  prompt: string
  tone: string
}[]

export const STORY_FORMATS = [
  'Storyline',
  'Episode',
  'Scene',
  'Chapter',
  'Tales',
] as const

export interface StudioAsset {
  id: string
  kind: AssetKind
  url: string
  name: string
  size?: number
  mime?: string
  preview?: string
  duration?: number
  source: SourceKind
  generationId?: string
  status: 'ready' | 'uploading' | 'error'
  progress?: number
  error?: string
}

export interface Shot {
  id: string
  prompt: string
  status: 'idle' | 'queued' | 'processing' | 'done' | 'failed'
  videoUrl?: string
  progress?: number
  eta?: number
  error?: string
  generationId?: string
  ingredients: StudioAsset[]
  createdAt: number
  model: string
  duration: number
  aspect: '16:9' | '9:16' | '1:1' | '21:9'
  style?: string
  storyFormats?: string[]
  characters?: StoryCharacter[]
}

export interface RemoteGeneration {
  id: string
  mode: string
  prompt: string
  result: string
  metadata: string | Record<string, any> | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const VIDEO_MODELS = [
  {
    id: 'agnes-video-v2.0',
    label: 'Cinema 2.0',
    tag: 'Balanced',
    speed: '~3 min',
    accent: 'from-cyan-500 to-blue-600',
    icon: '◈',
  },
  {
    id: 'agnes-video-v2.0-hq',
    label: 'Cinema HQ',
    tag: 'Highest quality',
    speed: '~6 min',
    accent: 'from-fuchsia-500 to-purple-600',
    icon: '✦',
  },
  {
    id: 'agnes-video-v2.0-fast',
    label: 'Turbo',
    tag: 'Fast draft',
    speed: '~45 s',
    accent: 'from-amber-500 to-orange-600',
    icon: '⚡',
  },
  {
    id: 'agnes-video-v2.0-motion',
    label: 'Motion',
    tag: 'High movement',
    speed: '~4 min',
    accent: 'from-emerald-500 to-teal-600',
    icon: '➤',
  },
] as const

export const ASPECTS = [
  { id: '16:9', label: '16:9', hint: 'Landscape' },
  { id: '9:16', label: '9:16', hint: 'Vertical' },
  { id: '1:1',  label: '1:1',  hint: 'Square' },
  { id: '21:9', label: '21:9', hint: 'Cinema' },
] as const

export const STYLES = [
  'Cinematic',
  'Documentary',
  'Anime',
  'Noir',
  'Dreamy',
  'Hyperreal',
  'Retro film',
  'Music video',
]

// ─────────────────────────────────────────────────────────────
// Upload rules & validation
// ─────────────────────────────────────────────────────────────

export const UPLOAD_RULES: Record<
  'image' | 'video' | 'audio',
  { maxBytes: number; mimes: string[] }
> = {
  image: {
    maxBytes: 12 * 1024 * 1024,
    mimes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/avif',
    ],
  },
  video: {
    maxBytes: 250 * 1024 * 1024,
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  audio: {
    maxBytes: 60 * 1024 * 1024,
    mimes: [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/webm',
      'audio/ogg',
    ],
  },
}

export function validateFile(
  file: File,
  kind: AssetKind
): string | null {
  if (kind === 'text') return null
  const rule = UPLOAD_RULES[kind]
  if (!rule) return null

  const mime = (file.type || '').toLowerCase()
  if (mime && !rule.mimes.includes(mime)) {
    return `Unsupported ${kind} format: ${mime || 'unknown'}`
  }
  if (file.size > rule.maxBytes) {
    return `File too large (max ${(rule.maxBytes / 1024 / 1024).toFixed(0)} MB)`
  }
  return null
}

export function kindFromMime(mime: string): AssetKind | null {
  if (!mime) return null
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────

export function fmtBytes(n?: number) {
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function fmtTime(s?: number) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// Generation → StudioAsset normalization
// ─────────────────────────────────────────────────────────────

const KIND_ALIASES: Record<string, AssetKind> = {
  image: 'image',
  images: 'image',
  Image: 'image',
  IMAGE: 'image',

  video: 'video',
  videos: 'video',
  Video: 'video',
  VIDEO: 'video',
  movie: 'video',

  audio: 'audio',
  audios: 'audio',
  Audio: 'audio',
  AUDIO: 'audio',
  sound: 'audio',
  music: 'audio',
  tts: 'audio',

  text: 'text',
  texts: 'text',
  Text: 'text',
  TEXT: 'text',
  chat: 'text',
  Chat: 'text',
}

function normalizeKind(raw: unknown): AssetKind | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim()
  return KIND_ALIASES[key] ?? KIND_ALIASES[key.toLowerCase()] ?? null
}

function pickUrl(g: any): string | null {
  const candidates = [
    g.result,
    g.url,
    g.asset_url,
    g.output_url,
    g.video_url,
    g.audio_url,
    g.image_url,
    g.metadata?.url,
    g.metadata?.result,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return null
}

function pickCreatedAt(g: any): string {
  return (
    g.created_at ?? g.createdAt ?? g.created ?? new Date().toISOString()
  )
}

function pickPrompt(g: any): string {
  return (
    g.prompt ?? g.metadata?.prompt ?? g.name ?? g.title ?? 'Untitled'
  )
}

function prettyName(
  prompt: string,
  kind: AssetKind,
  index: number
): string {
  const trimmed = (prompt ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return `${kind} #${index + 1}`
  return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed
}

export function projectGenerationsToAssets(
  generations: Generation[] | undefined | null
): StudioAsset[] {
  if (!Array.isArray(generations)) return []

  const out: StudioAsset[] = []

  generations.forEach((g, i) => {
    const kind = normalizeKind((g as any).mode)
    if (!kind) return

    const url = pickUrl(g)
    if (!url) return

    out.push({
      id: `gen-${(g as any).id ?? i}`,
      kind,
      url,
      name: prettyName(pickPrompt(g), kind, i),
      source: 'project',
      generationId: (g as any).id,
      status: 'ready',
    })
  })

  return out
}

// ─────────────────────────────────────────────────────────────
// Fetch generations from the API
//
// Primary path:  GET /api/projects/[projectId]  (already returns
//               200 in this app and includes .generations)
// Fallback:      GET /api/projects/[projectId]/generations
//                (kept for when/if that route is deployed)
// ─────────────────────────────────────────────────────────────

export async function fetchProjectGenerations(
  projectId: string
): Promise<RemoteGeneration[]> {
  if (!projectId) return []

  // Primary — project detail endpoint
  try {
    const res = await fetch(`/api/projects/${projectId}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const gens =
        data?.generations ??
        data?.project?.generations ??
        data?.data?.generations ??
        []
      if (Array.isArray(gens) && gens.length > 0) {
        console.log(
          '[video-studio] fetched',
          gens.length,
          'generations via /api/projects/[id]'
        )
        return gens
      }
      // Even if empty, if the key exists, trust it
      if (Array.isArray(gens)) {
        console.log(
          '[video-studio] project has 0 generations (via project route)'
        )
        return gens
      }
    }
  } catch (e) {
    console.warn('[video-studio] project route fetch failed', e)
  }

  // Fallback — dedicated generations endpoint (may 404)
  try {
    const res = await fetch(`/api/projects/${projectId}/generations`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const gens = Array.isArray(data?.generations)
      ? data.generations
      : []
    console.log(
      '[video-studio] fetched',
      gens.length,
      'generations via /generations'
    )
    return gens
  } catch (e) {
    console.error(
      '[video-studio] fetchProjectGenerations failed entirely:',
      e
    )
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// Optional re-export
// ─────────────────────────────────────────────────────────────

export { pickCreatedAt }