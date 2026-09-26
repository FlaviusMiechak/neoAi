//app/generate/page
'use client'

import Link from 'next/link'

type Mode = 'text' | 'image' | 'audio' | 'video' | 'chat'

const MODES: { id: Mode; label: string; icon: string; description: string }[] = [
  { id: 'text',  label: 'Text',  icon: '📝', description: 'Generate text content' },
  { id: 'image', label: 'Image', icon: '🖼️', description: 'Generate images from prompts' },
  { id: 'audio', label: 'Audio', icon: '🎵', description: 'Generate voice or music' },
  { id: 'video', label: 'Video', icon: '🎬', description: 'Generate short videos' },
  { id: 'chat',  label: 'Chat',  icon: '💬', description: 'Converse with the model' },
]

export default function GeneratePage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI Studio</h1>
        <p className="text-sm text-muted-foreground">Pick a mode to get started.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {MODES.map((m) => (
          <Link
            key={m.id}
            href={`/generate/${m.id}`}
            className="rounded-lg border border-border bg-card p-4 text-center transition hover:bg-muted"
          >
            <div className="text-2xl">{m.icon}</div>
            <div className="mt-2 text-sm font-medium">{m.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}