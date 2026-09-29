// src/app/generate/[mode]/_components/ImageMode.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  useRequireProject,
  useCurrentProject,
  type Generation,
} from '@/lib/useCurrentProject'
import { ProjectPickerModal } from '@/components/ProjectPickerModal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text?: string
  imageUrl?: string
  referenceUrl?: string
  createdAt: string
  loading?: boolean
}

export default function ImageMode() {
  const { ready, needsProject, project, currentProjectId } =
    useRequireProject()
  const { refreshProject: refreshCurrentProject } = useCurrentProject()

  const [prompt, setPrompt] = useState('')
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const [referenceName, setReferenceName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const history = (project?.generations ?? []).filter(
    (g) => g.mode === 'image'
  )

  // Seed chat from existing history (oldest first)
  useEffect(() => {
    if (!project) return
    const seeded: Message[] = [...history]
      .reverse()
      .map((g) => ({
        id: g.id,
        role: 'assistant' as const,
        imageUrl: g.result,
        text: g.prompt,
        createdAt: g.createdAt,
      }))
    setMessages(seeded)
  }, [project?.id])

  // Auto-scroll to newest message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  useEffect(() => {
    if (needsProject) setPickerOpen(true)
  }, [needsProject])

  useEffect(() => {
    if (ready) setPickerOpen(false)
  }, [ready])

  async function handleReferenceUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file || !currentProjectId) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', currentProjectId)
      formData.append('purpose', 'reference')

      const localPreview = URL.createObjectURL(file)
      setReferenceUrl(localPreview)
      setReferenceName(file.name)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      if (data.url) setReferenceUrl(data.url)
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`)
      setReferenceUrl(null)
      setReferenceName(null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function run() {
    if (!prompt.trim() || !currentProjectId || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: prompt.trim(),
      referenceUrl: referenceUrl ?? undefined,
      createdAt: new Date().toISOString(),
    }
    const placeholderId = crypto.randomUUID()
    const placeholder: Message = {
      id: placeholderId,
      role: 'assistant',
      loading: true,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, placeholder])
    setPrompt('')
    setStatus('Generating…')
    setLoading(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'image',
          prompt: userMsg.text,
          projectId: currentProjectId,
          referenceImageUrl: referenceUrl,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      const url = data.url || data.image_url || ''
      if (!url) throw new Error('No image in response')

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, loading: false, imageUrl: url }
            : m
        )
      )

      setStatus('Done')
      setReferenceUrl(null)
      setReferenceName(null)
      await refreshCurrentProject()
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                loading: false,
                text: `⚠️ ${err.message ?? 'Request failed'}`,
              }
            : m
        )
      )
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      run()
    }
  }

  async function handleDelete(generationId: string) {
    if (!confirm('Delete this image? This cannot be undone.')) return
    try {
      const res = await fetch(
        `/api/projects/${currentProjectId}/generations/${generationId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Delete failed')
      setMessages((prev) => prev.filter((m) => m.id !== generationId))
      await refreshCurrentProject()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const totalImages = history.length
  const totalGenerations = project?.generations?.length ?? 0

  if (!ready && !needsProject) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/generate"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Studio
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold">Image</h1>
            {project && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground truncate">
                  {project.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {totalImages} image{totalImages !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          <button
            onClick={() => setPickerOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border px-3 py-1.5"
          >
            {project ? '📂 Switch project' : '📂 Select project'}
          </button>
        </div>
      </header>

      {/* ── Scroll area: centered chat ──────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <div className="text-6xl">🖼️</div>
              <h2 className="text-2xl font-semibold">
                What would you like to create?
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Describe an image in detail, or attach a reference to edit and
                remix. Try &quot;a cinematic portrait of a fox in a misty
                forest, soft golden light&quot;.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 max-w-xl mx-auto">
                {[
                  'A cinematic portrait of a fox in a misty forest at dawn',
                  'Isometric 3D illustration of a cozy bookshop',
                  'Minimalist poster of a mountain range at sunset',
                  'A vintage car parked on a rainy neon-lit street',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="text-left text-xs rounded-lg border border-border bg-card p-3 hover:border-primary/50 hover:bg-muted transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onOpenLightbox={setLightbox}
              onDelete={
                m.role === 'assistant' && !m.loading
                  ? () => handleDelete(m.id)
                  : undefined
              }
            />
          ))}

          <div className="h-32" />
        </div>
      </div>

      {/* ── Sticky composer ─────────────────────────────── */}
      <div className="border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-3 px-3 py-4 sm:px-6">
          {referenceUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt="Reference"
                className="w-12 h-12 rounded object-cover bg-black"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {referenceName ?? 'Reference image'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? 'Uploading…' : 'Will be used as reference'}
                </p>
              </div>
              <button
                onClick={() => {
                  setReferenceUrl(null)
                  setReferenceName(null)
                }}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
                aria-label="Remove reference"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary transition">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !ready}
              className="flex-shrink-0 rounded-xl p-2.5 hover:bg-muted disabled:opacity-50 transition"
              title="Attach reference image"
            >
              {uploading ? (
                <span className="text-xs">…</span>
              ) : (
                <span className="text-lg leading-none">📎</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReferenceUpload}
              className="hidden"
            />

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe an image, or ask to edit your reference…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
              style={{ minHeight: '40px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            />

            <button
              onClick={run}
              disabled={loading || !prompt.trim() || !ready}
              className="flex-shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 transition"
            >
              {loading ? '…' : '↑'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              {status || 'Enter to send · Shift+Enter for new line'}
            </span>
            <span>
              {totalGenerations} total generation
              {totalGenerations !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Lightbox ───────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl"
          >
            ✕
          </button>
          <a
            href={lightbox}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 right-6 rounded-lg bg-white/10 backdrop-blur px-4 py-2 text-sm text-white"
          >
            ⬇ Download
          </a>
        </div>
      )}

      {/* ── Project picker ─────────────────────────────── */}
      <ProjectPickerModal
        open={pickerOpen}
        onClose={() => {
          if (currentProjectId) setPickerOpen(false)
        }}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   Message bubble
   ══════════════════════════════════════════════════════ */

function MessageBubble({
  message,
  onOpenLightbox,
  onDelete,
}: {
  message: Message
  onOpenLightbox: (url: string) => void
  onDelete?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          {message.referenceUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.referenceUrl}
              alt="Reference"
              className="rounded-xl max-h-48 object-contain bg-black ml-auto"
            />
          )}
          <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
            {message.text}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2 group">
        {message.loading ? (
          <div className="rounded-xl border border-border bg-card p-6 w-72">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              Generating image…
            </div>
            <div className="mt-4 aspect-square rounded-lg bg-muted animate-pulse" />
          </div>
        ) : message.imageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt={message.text ?? 'Generated'}
              className="w-full cursor-zoom-in"
              onClick={() => onOpenLightbox(message.imageUrl!)}
            />

            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => onOpenLightbox(message.imageUrl!)}
                className="rounded-lg bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-white"
              >
                ⤢ View
              </button>
              <a
                href={message.imageUrl}
                download
                className="rounded-lg bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-white"
              >
                ⬇
              </a>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-lg bg-black/70 backdrop-blur px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg z-10 text-foreground">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(message.imageUrl!)
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted"
                    >
                      🔗 Copy URL
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          onDelete()
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-muted"
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-red-400">
            {message.text ?? 'Something went wrong'}
          </div>
        )}

        {!message.loading && message.text && message.imageUrl && (
          <p className="text-xs text-muted-foreground px-1">
            &quot;{message.text}&quot;
          </p>
        )}
      </div>
    </div>
  )
}