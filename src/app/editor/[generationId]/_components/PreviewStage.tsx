// src/app/editor/[generationId]/_components/PreviewStage.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Generation } from '@/lib/generation-types'

export default function PreviewStage({
  generation,
  playing,
  playhead,
  onPlayhead,
  onDuration,
  onPlaying,
}: {
  generation: Generation
  playing: boolean
  playhead: number
  onPlayhead: (t: number) => void
  onDuration: (d: number) => void
  onPlaying: (p: boolean) => void
}) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)

  // Sync playhead → media element
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    if (Math.abs(el.currentTime - playhead) > 0.05) {
      el.currentTime = playhead
    }
  }, [playhead])

  // Sync playing state
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    if (playing) el.play().catch(() => {})
    else el.pause()
  }, [playing, generation.id])

  return (
    <div className="flex-1 min-h-0 bg-[#0a0a0c] flex items-center justify-center relative">
      {/* Canvas area with subtle checkerboard */}
      <div className="max-w-full max-h-full p-6 flex items-center justify-center">
        {generation.mode === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={generation.result}
            alt={generation.prompt}
            className="max-w-full max-h-full object-contain shadow-2xl rounded"
            style={{ maxHeight: 'calc(100vh - 340px)' }}
          />
        )}

        {generation.mode === 'video' && (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={generation.result}
            controls={false}
            playsInline
            onLoadedMetadata={(e) => onDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => onPlayhead(e.currentTarget.currentTime)}
            onEnded={() => onPlaying(false)}
            className="max-w-full max-h-full object-contain shadow-2xl rounded"
            style={{ maxHeight: 'calc(100vh - 340px)' }}
          />
        )}

        {generation.mode === 'audio' && (
          <div className="w-full max-w-2xl bg-[#151518] rounded-xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-sm text-neutral-300">{generation.prompt}</p>
            </div>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={generation.result}
              onLoadedMetadata={(e) => onDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => onPlayhead(e.currentTarget.currentTime)}
              onEnded={() => onPlaying(false)}
              className="w-full"
              controls
            />
          </div>
        )}
      </div>
    </div>
  )
}