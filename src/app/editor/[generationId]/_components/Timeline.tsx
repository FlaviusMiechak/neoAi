// src/app/editor/[generationId]/_components/Timeline.tsx
'use client'

import { useRef } from 'react'
import type { Generation } from '@/lib/generation-types'

export default function Timeline({
  generation,
  assets,
  duration,
  playhead,
  onPlayhead,
  zoom,
  selectedAssetId,
  onSelectAsset,
}: {
  generation: Generation
  assets: Generation[]
  duration: number
  playhead: number
  onPlayhead: (t: number) => void
  zoom: number
  selectedAssetId: string | null
  onSelectAsset: (id: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  function handleScrub(e: React.MouseEvent<HTMLDivElement>) {
    const el = trackRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    onPlayhead(pct * duration)
  }

  const pxPerSecond = 40 * zoom
  const totalWidth = Math.max(duration * pxPerSecond, 800)
  const playheadPx = playhead * pxPerSecond

  return (
    <div className="h-[220px] border-t border-neutral-800 bg-[#111114] flex flex-col flex-shrink-0">
      {/* Ruler */}
      <div className="h-7 border-b border-neutral-800 flex items-end px-3 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: totalWidth }}
        >
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, s) => (
            <div
              key={s}
              className="absolute top-0 h-full flex flex-col items-center justify-end pb-1"
              style={{ left: s * pxPerSecond }}
            >
              <div className="w-px h-2 bg-neutral-700" />
              <span className="text-[9px] text-neutral-500 mt-0.5">
                {formatTime(s)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div
        ref={trackRef}
        onClick={handleScrub}
        className="flex-1 relative overflow-x-auto overflow-y-hidden cursor-pointer"
      >
        <div className="relative h-full" style={{ width: totalWidth }}>
          {/* Video track */}
          <Track label="Video" height={56}>
            {generation.mode === 'video' && (
              <Clip
                selected
                width={duration * pxPerSecond}
                color="blue"
                label={generation.prompt || 'Video'}
              />
            )}
            {generation.mode !== 'video' && (
              <div className="text-xs text-neutral-600 px-3 py-2">
                No video clip loaded
              </div>
            )}
          </Track>

          {/* Image track */}
          <Track label="Image" height={56}>
            {generation.mode === 'image' && (
              <Clip
                selected
                width={duration * pxPerSecond || 200}
                color="emerald"
                label={generation.prompt || 'Image'}
              />
            )}
          </Track>

          {/* Audio track */}
          <Track label="Audio" height={56}>
            {generation.mode === 'audio' && (
              <Clip
                selected
                width={duration * pxPerSecond}
                color="purple"
                label={generation.prompt || 'Audio'}
              />
            )}
          </Track>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
            style={{ left: playheadPx }}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Track({
  label,
  height,
  children,
}: {
  label: string
  height: number
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center border-b border-neutral-800/60">
      <div
        className="w-20 flex-shrink-0 text-[10px] uppercase tracking-wider text-neutral-500 px-2 py-2"
        style={{ height }}
      >
        {label}
      </div>
      <div className="flex-1 relative" style={{ height }}>
        {children}
      </div>
    </div>
  )
}

function Clip({
  width,
  color,
  label,
  selected,
}: {
  width: number
  color: 'blue' | 'emerald' | 'purple'
  label: string
  selected?: boolean
}) {
  const palette = {
    blue: 'bg-blue-600/30 border-blue-500 text-blue-100',
    emerald: 'bg-emerald-600/30 border-emerald-500 text-emerald-100',
    purple: 'bg-purple-600/30 border-purple-500 text-purple-100',
  }[color]

  return (
    <div
      className={`absolute inset-y-1 left-0 rounded border ${palette} ${
        selected ? 'ring-2 ring-blue-500/50' : ''
      } px-2 py-1 text-xs overflow-hidden whitespace-nowrap`}
      style={{ width: Math.max(width, 60) }}
    >
      {label}
    </div>
  )
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}