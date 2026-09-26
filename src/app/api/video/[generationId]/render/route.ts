import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import pool from '@/utils/supabase/db'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await context.params
  const timeline = await request.json()

  const rows = await pool`
    SELECT result FROM generations
    WHERE id = ${generationId}
    LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sourceUrl = rows[0].result
  const outDir = path.join(process.cwd(), 'public', 'renders')
  await mkdir(outDir, { recursive: true })

  const outName = `${crypto.randomUUID()}.mp4`
  const outPath = path.join(outDir, outName)

  // Download the source to a temp file (if it's remote)
  // For simplicity assume source is a local URL under /public
  const srcPath = path.join(process.cwd(), 'public', sourceUrl.replace(/^\//, ''))

  // Build the FFmpeg filter_complex for all clips
  const inputs = timeline.clips.map((c: any) => [
    '-ss', String(c.start),
    '-t', String(c.end - c.start),
    '-i', srcPath,
  ]).flat()

  const filters = timeline.clips.map((c: any, i: number) =>
    `[${i}:v]setpts=${(1 / c.speed).toFixed(4)}*PTS,scale=1920:1080[v${i}]`
  ).join(';')
  const concat = timeline.clips.map((_: any, i: number) => `[v${i}]`).join('') +
    `concat=n=${timeline.clips.length}:v=1:a=0[outv]`

  const args = [
    ...inputs,
    '-filter_complex', `${filters};${concat}`,
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-y',
    outPath,
  ]

  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', args)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
    ff.on('error', reject)
  })

  return NextResponse.json({ url: `/renders/${outName}` })
}