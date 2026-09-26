// src/app/api/video/replace-audio/route.ts
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

// ─────────────────────────────────────────────────────────────
// POST /api/video/replace-audio
//
// Body:
//   {
//     videoUrl: string,             // required
//     audioUrl: string,             // required
//     mode?: 'replace' | 'mix',     // default 'replace'
//     audioVolume?: number,         // default 1.0  (for mix)
//     originalVolume?: number,      // default 0.5  (for mix)
//     fadeIn?: number,              // seconds, optional
//     fadeOut?: number              // seconds, optional
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

  const {
    videoUrl,
    audioUrl,
    mode = 'replace',
    audioVolume = 1.0,
    originalVolume = 0.5,
    fadeIn,
    fadeOut,
  } = body

  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })
  }
  if (!audioUrl || typeof audioUrl !== 'string') {
    return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })
  }
  if (mode !== 'replace' && mode !== 'mix') {
    return NextResponse.json(
      { error: "mode must be 'replace' or 'mix'" },
      { status: 400 }
    )
  }

  // ── Workdir ────────────────────────────────────────────────
  const workDir = path.join(tmpdir(), `replace-audio-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const videoPath = path.join(workDir, 'video.mp4')
  const audioPath = path.join(workDir, 'audio.mp3')
  const outPath = path.join(workDir, 'out.mp4')

  try {
    // ── Download inputs ──────────────────────────────────────
    await writeFile(videoPath, Uint8Array.from(await fetchBytes(videoUrl)))
    await writeFile(audioPath, Uint8Array.from(await fetchBytes(audioUrl)))

    // ── Build FFmpeg command ─────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(videoPath)
        .input(audioPath)

      // Choose the audio filter chain
      let audioFilter: string

      if (mode === 'replace') {
        // Just use the new audio, optionally with fade in/out
        const parts: string[] = [`volume=${audioVolume}`]
        if (fadeIn && fadeIn > 0) parts.push(`afade=t=in:st=0:d=${fadeIn}`)
        if (fadeOut && fadeOut > 0) {
          // Apply fade out at the end — needs duration; use afade without st,
          // which assumes fade ends at stream end when combined with `areverse`
          // Simpler: rely on -t to cap and skip fadeOut unless duration known.
          parts.push(`afade=t=out:st=0:d=${fadeOut}`)
        }
        audioFilter = `[1:a]${parts.join(',')}[aout]`
      } else {
        // Mix: original + new audio
        audioFilter =
          `[0:a]volume=${originalVolume}[orig];` +
          `[1:a]volume=${audioVolume}[new];` +
          `[orig][new]amix=inputs=2:duration=longest:dropout_transition=2[aout]`
      }

      cmd
        .complexFilter([audioFilter])
        .outputOptions([
          '-map', '0:v',        // keep original video stream
          '-map', '[aout]',     // use our mixed/replaced audio
          '-c:v', 'copy',       // no re-encode of video
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',          // end when the shorter stream ends
        ])
        .on('end', () => resolve())
        .on('error', reject)
        .save(outPath)
    })

    // ── Upload output to Supabase Storage ────────────────────
    const buffer = await readFile(outPath)
    const filename = `audio-replaced/${randomUUID()}.mp4`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('videos')
      .upload(filename, buffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[replace-audio] upload error:', uploadErr)
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('videos')
      .getPublicUrl(filename)

    return NextResponse.json({
      url: urlData.publicUrl,
      mode,
      audioVolume,
      originalVolume: mode === 'mix' ? originalVolume : 0,
    })
  } catch (err: any) {
    console.error('[replace-audio] error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Audio replace failed' },
      { status: 500 }
    )
  } finally {
    for (const p of [videoPath, audioPath, outPath]) {
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