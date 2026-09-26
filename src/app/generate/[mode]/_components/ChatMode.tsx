// src/app/generate/[mode]/_components/ChatMode.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRequireProject, useCurrentProject } from '@/lib/useCurrentProject'
import { ProjectPickerModal } from '@/components/ProjectPickerModal'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  loading?: boolean
}

export default function ChatMode() {
  const { ready, needsProject, project, currentProjectId } =
    useRequireProject()
  const { refreshProject: refreshCurrentProject } = useCurrentProject()

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Seed from project's chat generations (if any)
  useEffect(() => {
    if (!project) return
    const chatHistory = (project.generations ?? []).filter(
      (g) => g.mode === 'chat'
    )
    const seeded: ChatMessage[] = [...chatHistory]
      .reverse()
      .flatMap((g) => [
        {
          id: `${g.id}-u`,
          role: 'user' as const,
          content: g.prompt,
          createdAt: g.createdAt,
        },
        {
          id: `${g.id}-a`,
          role: 'assistant' as const,
          content: g.result,
          createdAt: g.createdAt,
        },
      ])
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

  async function send() {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }
    const placeholderId = crypto.randomUUID()
    const placeholder: ChatMessage = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      loading: true,
    }

    const nextMessages = [...messages, userMsg]
    setMessages([...nextMessages, placeholder])
    setInput('')
    setLoading(true)
    setStatus('Thinking…')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          projectId: currentProjectId,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? 'Chat failed')

      const reply = data.reply || data.text || '(no reply)'

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, loading: false, content: reply }
            : m
        )
      )
      setStatus('Done')
      await refreshCurrentProject()
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, loading: false, content: `⚠️ ${e.message}` }
            : m
        )
      )
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  async function clearConversation() {
    if (!confirm('Clear this conversation from view? Past generations stay saved.'))
      return
    setMessages([])
  }

  const totalGenerations = project?.generations?.length ?? 0
  const chatCount = (project?.generations ?? []).filter(
    (g) => g.mode === 'chat'
  ).length

  if (!ready && !needsProject) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur z-20">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/generate"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Studio
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold">Chat</h1>
            {project && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground truncate">
                  {project.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {chatCount} exchange{chatCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border px-3 py-1.5"
              >
                🧹 Clear view
              </button>
            )}
            <button
              onClick={() => setPickerOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border px-3 py-1.5"
            >
              {project ? '📂 Switch project' : '📂 Select project'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Scroll area: centered chat ──────────────────── */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <div className="text-6xl">💬</div>
              <h2 className="text-2xl font-semibold">
                How can I help you today?
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ask anything — brainstorm ideas, draft copy, explain concepts,
                or refine prompts for your other modes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 max-w-xl mx-auto">
                {[
                  'Give me 5 story ideas about a lost drone',
                  'Write a 30-second voiceover script for a product teaser',
                  'Explain how diffusion models work in simple terms',
                  'Help me write a better prompt for image generation',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
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
            <MessageBubble key={m.id} message={m} />
          ))}

          <div className="h-32" />
        </div>
      </div>

      {/* ── Sticky composer ─────────────────────────────── */}
      <div className="border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary transition">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message the assistant…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
              style={{ minHeight: '40px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            />

            <button
              onClick={send}
              disabled={loading || !input.trim() || !ready}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-1">
        <div
          className={`rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm whitespace-pre-wrap ${
            message.loading ? 'text-muted-foreground' : ''
          }`}
        >
          {message.loading ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
              <span className="ml-1">Thinking…</span>
            </div>
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  )
}