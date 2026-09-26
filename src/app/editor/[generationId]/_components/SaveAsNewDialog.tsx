// src/app/editor/[generationId]/_components/SaveAsNewDialog.tsx
'use client'

import { useState } from 'react'
import type { Generation } from '@/lib/generation-types'

export default function SaveAsNewDialog({
  open,
  onClose,
  parentGeneration,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  parentGeneration: Generation
  onSaved: (newGen: Generation) => void
}) {
  const [title, setTitle] = useState(parentGeneration.prompt ?? '')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function save() {
    setBusy(true)
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parentGeneration.project_id,
          mode: parentGeneration.mode,
          prompt: title,
          result: parentGeneration.result,
          metadata: {
            parentGenerationId: parentGeneration.id,
            source: 'editor',
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved(data)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-[#151518] p-6 space-y-4">
        <h2 className="text-base font-semibold">Save as new generation</h2>
        <div className="space-y-2">
          <label className="text-xs text-neutral-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0d0d0f] border border-neutral-800 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md bg-neutral-800 hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !title.trim()}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}