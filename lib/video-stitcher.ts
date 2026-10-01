// lib/video-stitcher.ts
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'


ffmpeg.setFfmpegPath(ffmpegPath as unknown as string)

export async function downloadToTmp(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest))
}

interface StitchOpts {
  width: number
  height: number
  fps?: number
  transition?: 'fade' | null
  transitionDuration?: number
}

export const TARGET_DURATION_SEC = 10 * 60 // 6 minutes
export const CLIP_DURATION_SEC = 18        // ~num_frames 441 @ 24fps

export function shotCountForTarget(targetSec = TARGET_DURATION_SEC) {
  // Round up, add a small buffer
  return Math.max(1, Math.ceil(targetSec / CLIP_DURATION_SEC))
}

export async function stitchClips(
  inputPaths: string[],
  outputPath: string,
  opts: StitchOpts
): Promise<void> {
  if (!inputPaths.length) throw new Error('No clips to stitch')

  // Single clip — just re-encode to normalized format
  if (inputPaths.length === 1) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPaths[0])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          `-vf scale=${opts.width}:${opts.height}:force_original_aspect_ratio=decrease,pad=${opts.width}:${opts.height}:(ow-iw)/2:(oh-ih)/2`,
          `-r ${opts.fps ?? 24}`,
        ])
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath)
    })
    return
  }

  // Multiple clips → concat demuxer with optional xfade
  if (!opts.transition) {
    await concatHard(inputPaths, outputPath, opts)
  } else {
    await concatWithFade(inputPaths, outputPath, opts)
  }
}

// Plain concat (fast, no transitions)
async function concatHard(
  inputs: string[],
  outputPath: string,
  opts: StitchOpts
) {
  // Re-encode each to identical format, then concat
  const normalized: string[] = []
  const scaleFilter = `scale=${opts.width}:${opts.height}:force_original_aspect_ratio=decrease,pad=${opts.width}:${opts.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`

  for (let i = 0; i < inputs.length; i++) {
    const out = `${outputPath}.part${i}.mp4`
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputs[i])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          `-vf ${scaleFilter}`,
          `-r ${opts.fps ?? 24}`,
          '-ar 48000',
          '-ac 2',
          '-preset veryfast',
        ])
        .on('end', () => resolve())
        .on('error', reject)
        .save(out)
    })
    normalized.push(out)
  }

  // Concat via demuxer list
  const listPath = `${outputPath}.list.txt`
  await fs.writeFile(
    listPath,
    normalized.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  )

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })

  // Cleanup
  await Promise.all(normalized.map((p) => fs.unlink(p).catch(() => {})))
  await fs.unlink(listPath).catch(() => {})
}

// xfade transitions between clips (slower but smooth)
async function concatWithFade(
  inputs: string[],
  outputPath: string,
  opts: StitchOpts
) {
  const d = opts.transitionDuration ?? 0.5
  const fps = opts.fps ?? 24
  const scale = `scale=${opts.width}:${opts.height}:force_original_aspect_ratio=decrease,pad=${opts.width}:${opts.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`

  const cmd = ffmpeg()
  inputs.forEach((p) => cmd.input(p))

  // Build filter_complex chain
  const parts: string[] = []
  inputs.forEach((_, i) => {
    parts.push(`[${i}:v]${scale}[v${i}]`)
  })

  let lastLabel = 'v0'
  let offset = 0
  for (let i = 1; i < inputs.length; i++) {
    // Approximate clip duration; replace with real probe if needed
    const clipDur = 18 // seconds — matches num_frames/fps
    offset += clipDur - d
    const out = `x${i}`
    parts.push(
      `[${lastLabel}][v${i}]xfade=transition=fade:duration=${d}:offset=${offset.toFixed(3)}[${out}]`
    )
    lastLabel = out
  }

  // Audio: amix with crossfade is complex; simplest = concat audio
  const audioInputs = inputs.map((_, i) => `[${i}:a]`).join('')
  parts.push(`${audioInputs}concat=n=${inputs.length}:v=0:a=1[aout]`)

  await new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter(parts.join(';'))
      .outputOptions([
        '-map', `[${lastLabel}]`,
        '-map', '[aout]',
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset veryfast',
        '-c:a aac',
        '-ar 48000',
      ])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

export async function splitPromptIntoShots(
  basePrompt: string,
  shotCount: number,
  auth: Record<string, string>
): Promise<string[]> {
  const res = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
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
            'Return ONLY a JSON array of strings, no markdown.',
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
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const arr = JSON.parse(cleaned)
    if (Array.isArray(arr) && arr.length) return arr.slice(0, shotCount)
  } catch {}
  // fallback: repeat base prompt with "shot k/N" suffix
  return Array.from({ length: shotCount }, (_, i) =>
    `${basePrompt} (Shot ${i + 1} of ${shotCount}, continuous story)`
  )
}