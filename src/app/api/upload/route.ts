// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/auth'
import { getProject } from '@/lib/projects'
import { addGeneration, type GenerationMode } from '@/lib/generation'

export const dynamic = 'force-dynamic'

// ── Bucket name ──────────────────────────────────────────────
const BUCKET = 'uploads'

// ── Limits per category ──────────────────────────────────────
const MAX_BYTES_BY_KIND: Record<'image' | 'video' | 'audio', number> = {
  image: 25 * 1024 * 1024,   // 25 MB
  video: 250 * 1024 * 1024,  // 250 MB
  audio: 60 * 1024 * 1024,   // 60 MB
}

// ── Allowed MIME types ───────────────────────────────────────
const ALLOWED_IMAGES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
])

const ALLOWED_VIDEOS = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
])

const ALLOWED_AUDIO = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
])

const ALLOWED_ALL = new Set<string>([
  ...ALLOWED_IMAGES,
  ...ALLOWED_VIDEOS,
  ...ALLOWED_AUDIO,
])

// ── MIME → extension sanity map ──────────────────────────────
const MIME_TO_EXT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/avif': ['.avif'],
  'image/bmp': ['.bmp'],
  'image/svg+xml': ['.svg'],
  'image/tiff': ['.tif', '.tiff'],

  'video/mp4': ['.mp4', '.m4v'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-matroska': ['.mkv'],
  'video/x-msvideo': ['.avi'],
  'video/mpeg': ['.mpeg', '.mpg'],
  'video/ogg': ['.ogv'],

  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/webm': ['.weba'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/aac': ['.aac'],
  'audio/flac': ['.flac'],
}

function categoryOf(mime: string): 'image' | 'video' | 'audio' | null {
  if (ALLOWED_IMAGES.has(mime)) return 'image'
  if (ALLOWED_VIDEOS.has(mime)) return 'video'
  if (ALLOWED_AUDIO.has(mime)) return 'audio'
  return null
}

// ─────────────────────────────────────────────────────────────
// POST /api/upload
//
// FormData fields:
//   file       — required
//   projectId  — required
//   prompt     — optional (falls back to "Uploaded: <name>")
//   purpose    — 'generation' (default) | 'reference'
//   kind       — optional hint; server derives real kind from MIME
//
// Response:
//   { url, generationId?, kind, size, mime }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Form ──────────────────────────────────────────────────
  let form: FormData
  try {
    form = await request.formData()
  } catch (e: any) {
    return NextResponse.json(
      { error: `Invalid form data: ${e?.message ?? 'unknown'}` },
      { status: 400 }
    )
  }

  const file = form.get('file')
  const projectId = String(form.get('projectId') ?? '').trim()
  const prompt = String(form.get('prompt') ?? '')
  const purpose = String(form.get('purpose') ?? 'generation') as
    | 'generation'
    | 'reference'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    )
  }
  if (purpose !== 'generation' && purpose !== 'reference') {
    return NextResponse.json(
      { error: `Invalid purpose: ${purpose}` },
      { status: 400 }
    )
  }

  // ── MIME ──────────────────────────────────────────────────
  const mime = (file.type || '').toLowerCase()
  if (!mime) {
    return NextResponse.json(
      { error: 'Missing Content-Type on uploaded file' },
      { status: 415 }
    )
  }

  const category = categoryOf(mime)

  if (purpose === 'reference') {
    if (!ALLOWED_IMAGES.has(mime)) {
      return NextResponse.json(
        {
          error: `Reference must be an image. Got: ${mime}`,
          allowed: [...ALLOWED_IMAGES],
        },
        { status: 415 }
      )
    }
  } else if (!ALLOWED_ALL.has(mime) || !category) {
    return NextResponse.json(
      {
        error: `Unsupported type: ${mime}`,
        allowed: {
          image: [...ALLOWED_IMAGES],
          video: [...ALLOWED_VIDEOS],
          audio: [...ALLOWED_AUDIO],
        },
      },
      { status: 415 }
    )
  }

  // ── Kind & size ───────────────────────────────────────────
  const kind: 'image' | 'video' | 'audio' =
    purpose === 'reference'
      ? 'image'
      : (category as 'image' | 'video' | 'audio')

  const maxBytes = MAX_BYTES_BY_KIND[kind]
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `File too large for ${kind} (max ${(maxBytes / 1024 / 1024).toFixed(0)} MB)`,
      },
      { status: 413 }
    )
  }

  // ── Extension sanity check ────────────────────────────────
  const rawExt = file.name.includes('.')
    ? '.' + file.name.split('.').pop()!.toLowerCase()
    : ''
  const allowedExts = MIME_TO_EXT[mime] ?? []

  if (allowedExts.length > 0 && rawExt && !allowedExts.includes(rawExt)) {
    return NextResponse.json(
      {
        error: `Extension "${rawExt}" doesn't match MIME type "${mime}". Expected: ${allowedExts.join(', ')}`,
      },
      { status: 415 }
    )
  }

  const ext = rawExt || allowedExts[0] || ''

  // ── Ownership ─────────────────────────────────────────────
  const project = await getProject(userId, projectId)
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found or not owned by user' },
      { status: 403 }
    )
  }

  // ── Upload to storage ─────────────────────────────────────
  const folder = purpose === 'reference' ? 'references' : 'uploads'
  const objectPath = `${folder}/${userId}/${projectId}/${randomUUID()}${ext}`

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not read file: ${e?.message ?? 'unknown'}` },
      { status: 400 }
    )
  }

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    })

  if (uploadErr) {
    console.error('[upload] storage error:', uploadErr)
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadErr.message}` },
      { status: 500 }
    )
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(objectPath)

  const url = urlData.publicUrl

  // ── Persist as generation (skip for references) ──────────
  let generationId: string | undefined

  if (purpose !== 'reference') {
    try {
      const storageMode: GenerationMode = kind

      const generation = await addGeneration(userId, projectId, {
        mode: storageMode,
        prompt: prompt || `Uploaded: ${file.name}`,
        result: url,
        metadata: {
          source: 'upload',
          originalName: file.name,
          size: file.size,
          contentType: mime,
          provider: 'user-upload',
        },
      })

      generationId = generation.id
    } catch (e: any) {
      console.error('[upload] addGeneration failed:', e)
      // Still return the URL — the file uploaded successfully.
      // The user can retry persisting later if needed.
      return NextResponse.json(
        {
          url,
          kind,
          size: file.size,
          mime,
          warning: `File uploaded but could not be saved as a generation: ${e?.message ?? 'unknown'}`,
        },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({
    url,
    generationId,
    kind,
    size: file.size,
    mime,
  })
}