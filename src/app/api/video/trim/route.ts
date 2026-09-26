// src/app/api/video/trim/route.ts
import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { writeFile, readFile, mkdir } from 'fs/promises'
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

  try {
    const { videoUrl, start, end } = await request.json()
    if (!videoUrl || typeof start !== 'number' || typeof end !== 'number') {
      return NextResponse.json(
        { error: 'videoUrl, start, end required' },
        { status: 400 }
      )
    }
    if (end <= start) {
      return NextResponse.json(
        { error: 'end must be greater than start' },
        { status: 400 }
      )
    }

    const buffer = await fetchBytes(videoUrl)
    const tmpDir = path.join(tmpdir(), `trim-${randomUUID()}`)
    await mkdir(tmpDir, { recursive: true })

    const inPath = path.join(tmpDir, 'in.mp4')
    const outPath = path.join(tmpDir, 'out.mp4')

    await writeFile(inPath, Uint8Array.from(buffer))

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .setStartTime(start)
        .setDuration(end - start)
        .outputOptions(['-c', 'copy'])
        .on('end', () => resolve())
        .on('error', reject)
        .save(outPath)
    })

    const outBuffer = await readFile(outPath)
    const filename = `trims/${randomUUID()}.mp4`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('videos')
      .upload(filename, outBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('videos')
      .getPublicUrl(filename)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function fetchBytes(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    return Buffer.from(base64, 'base64')
  }
  if (url.startsWith('/')) {
    // Only works in dev when public/ is writable
    const full = path.join(process.cwd(), 'public', url)
    return readFile(full)
  }
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}