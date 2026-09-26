// src/app/editor/[generationId]/_components/LeftPanel.tsx
'use client'

import { useState } from 'react'
import type { Generation } from '@/lib/generation-types'

type Tab = 'media' | 'audio' | 'text' | 'effects'

export default function LeftPanel({
  assets,
  selectedId,
  onSelect,
  current,
  onSwapCurrent,
}: {
  assets: Generation[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  current: Generation
  onSwapCurrent: (g: Generation) => void
}) {
  const [tab, setTab] = useState<Tab>('media')
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all')

  const filtered = assets.filter((a) => {
    if (filter === 'all') return a.mode !== 'text' && a.mode !== 'chat'
    return a.mode === filter
  })

  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-neutral-800 bg-[#111114] flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        {(
          [
            ['media', '🎞️'],
            ['audio', '🎵'],
            ['text', 'T'],
            ['effects', '✨'],
          ] as const
        ).map(([value, icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 py-2.5 text-xs font-medium transition ${
              tab === value
                ? 'text-neutral-100 border-b-2 border-blue-500 -mb-px'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {icon} {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-neutral-800">
        <div className="flex gap-1">
          {(['all', 'image', 'video', 'audio'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2 py-1 rounded ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((a) => (
            <AssetTile
              key={a.id}
              generation={a}
              selected={selectedId === a.id}
              isCurrent={current.id === a.id}
              onSelect={() => onSelect(a.id === selectedId ? null : a.id)}
              onUse={() => onSwapCurrent(a)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-xs text-neutral-500 text-center py-8">
            No assets match this filter
          </p>
        )}
      </div>
    </aside>
  )
}

function AssetTile({
  generation,
  selected,
  isCurrent,
  onSelect,
  onUse,
}: {
  generation: Generation
  selected: boolean
  isCurrent: boolean
  onSelect: () => void
  onUse: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative aspect-square rounded-md overflow-hidden border cursor-pointer transition ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : isCurrent
            ? 'border-emerald-500'
            : 'border-neutral-800 hover:border-neutral-600'
      }`}
    >
      {generation.mode === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={generation.result}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
      {generation.mode === 'video' && (
        <video
          src={generation.result}
          muted
          preload="metadata"
          className="w-full h-full object-cover"
        />
      )}
      {generation.mode === 'audio' && (
        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center text-2xl">
          🎵
        </div>
      )}

      {isCurrent && (
        <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wide bg-emerald-600 text-white px-1.5 py-0.5 rounded">
          Current
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onUse()
          }}
          className="w-full text-[10px] bg-white/10 hover:bg-white/20 backdrop-blur rounded py-1 text-white"
        >
          Use
        </button>
      </div>
    </div>
  )
}