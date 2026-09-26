// src/app/editor/[generationId]/_components/StatusBar.tsx
'use client'

export default function StatusBar({
  duration,
  playhead,
  zoom,
  onZoom,
  resolution,
}: {
  duration: number
  playhead: number
  zoom: number
  onZoom: (z: number) => void
  resolution: string
}) {
  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-neutral-800 bg-[#151518] text-[10px] text-neutral-500 flex-shrink-0">
      <div className="flex items-center gap-4">
        <span>{formatTime(playhead)} / {formatTime(duration)}</span>
        <span className="text-neutral-700">|</span>
        <span>{resolution || '—'}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>Zoom</span>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={zoom}
          onChange={(e) => onZoom(parseFloat(e.target.value))}
          className="w-32 accent-blue-500"
        />
        <span className="w-10 text-right">{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  )
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}