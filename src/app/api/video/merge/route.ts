// src/app/api/video/merge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { getUserIdFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string)

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { videoUrl, voiceUrl, musicUrl, musicVolume = 0.6 } =
    await request.json()

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })
  }

  const workDir = path.join(tmpdir(), `merge-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const videoPath = path.join(workDir, 'video.mp4')
  const voicePath = path.join(workDir, 'voice.mp3')
  const musicPath = path.join(workDir, 'music.mp3')
  const outPath = path.join(workDir, 'out.mp4')

  try {
    // ── 1. Download inputs ─────────────────────────────────
    await writeFile(videoPath, toWriteableBytes(await fetchBytes(videoUrl)))
    if (voiceUrl) {
      await writeFile(
        voicePath,
        toWriteableBytes(await fetchBytes(voiceUrl))
      )
    }
    if (musicUrl) {
      await writeFile(
        musicPath,
        toWriteableBytes(await fetchBytes(musicUrl))
      )
    }

    // ── 2. Run FFmpeg ──────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg().input(videoPath)
      if (voiceUrl) cmd.input(voicePath)
      if (musicUrl) cmd.input(musicPath)

      const filters: string[] = []
      const audioInputs: string[] = []

      if (voiceUrl && musicUrl) {
        filters.push(
          `[1:a]volume=1.0[voice]`,
          `[2:a]volume=${musicVolume}[music]`,
          `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`
        )
        audioInputs.push('[aout]')
      } else if (voiceUrl) {
        filters.push(`[1:a]volume=1.0[aout]`)
        audioInputs.push('[aout]')
      } else if (musicUrl) {
        filters.push(`[1:a]volume=${musicVolume}[aout]`)
        audioInputs.push('[aout]')
      }

      cmd
        .outputOptions([
          '-map', '0:v',
          ...(audioInputs.length ? ['-map', audioInputs[0]] : []),
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
        ])
        .complexFilter(filters)
        .on('end', () => resolve())
        .on('error', reject)
        .save(outPath)
    })

    // ── 3. Upload to Supabase Storage ──────────────────────
    const buffer = await readFile(outPath)
    const filename = `merged/${randomUUID()}.mp4`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('videos')
      .upload(filename, buffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[merge] upload error:', uploadErr)
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('videos')
      .getPublicUrl(filename)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: any) {
    console.error('[merge] error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Merge failed' },
      { status: 500 }
    )
  } finally {
    // Best-effort cleanup of temp files
    for (const p of [videoPath, voicePath, musicPath, outPath]) {
      try {
        await unlink(p)
      } catch {}
    }
  }
}

async function fetchBytes(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    return Buffer.from(base64, 'base64')
  }
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

function toWriteableBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(buffer.byteLength))
  bytes.set(buffer)
  return bytes
}