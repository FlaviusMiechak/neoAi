// src/app/editor/[generationId]/_components/TopBar.tsx
'use client'

import Link from 'next/link'
import type { Generation } from '@/lib/generation-types'

export default function TopBar({
  generation,
  onSave,
}: {
  generation: Generation
  onSave: () => void
}) {
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-neutral-800 bg-[#151518] flex-shrink-0">
      {/* Left: nav + title */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={`/project/${generation.project_id}`}
          className="text-sm text-neutral-400 hover:text-neutral-100"
        >
          ← Project
        </Link>
        <div className="w-px h-5 bg-neutral-800" />
        <h1 className="text-sm font-medium truncate max-w-md">
          {generation.prompt || 'Untitled'}
        </h1>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          {generation.mode}
        </span>
      </div>

      {/* Center: undo / redo / etc. */}
      <div className="hidden md:flex items-center gap-1">
        <IconBtn label="Undo" disabled>↶</IconBtn>
        <IconBtn label="Redo" disabled>↷</IconBtn>
        <div className="w-px h-5 bg-neutral-800 mx-1" />
        <IconBtn label="Split">✂</IconBtn>
        <IconBtn label="Crop">⛶</IconBtn>
        <IconBtn label="Zoom">🔍</IconBtn>
      </div>

      {/* Right: save / export */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-white"
        >
          Save as new
        </button>
        <button className="text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5">
          Export
        </button>
      </div>
    </header>
  )
}

function IconBtn({
  children,
  label,
  disabled,
}: {
  children: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      title={label}
      disabled={disabled}
      className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 disabled:opacity-40"
    >
      {children}
    </button>
  )
}