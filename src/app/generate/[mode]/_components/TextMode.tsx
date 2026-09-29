// src/app/generate/[mode]/_components/TextMode.tsx
'use client'

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react'
import { useCurrentProject } from '@/lib/useCurrentProject'
import { format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface HistoryItem {
  id: string
  prompt: string
  result: string
  createdAt: string
  model?: string
  tokens?: number
}

type ModelId =
  | 'agnes-2.0-flash'
  | 'agnes-2.0-pro'
  | 'agnes-2.0-reasoning'
  | 'agnes-2.0-vision'

const MODELS: Record<
  ModelId,
  { label: string; tag: string; speed: string; accent: string; icon: string }
> = {
  'agnes-2.0-flash': {
    label: 'Flash',
    tag: 'Fast · General',
    speed: '~1.2s',
    accent: 'from-cyan-500 to-blue-600',
    icon: '⚡',
  },
  'agnes-2.0-pro': {
    label: 'Pro',
    tag: 'Balanced · Creative',
    speed: '~3.4s',
    accent: 'from-fuchsia-500 to-purple-600',
    icon: '◈',
  },
  'agnes-2.0-reasoning': {
    label: 'Reasoning',
    tag: 'Deep · Analytical',
    speed: '~12s',
    accent: 'from-amber-500 to-orange-600',
    icon: '⟁',
  },
  'agnes-2.0-vision': {
    label: 'Vision',
    tag: 'Multimodal · Images',
    speed: '~2.8s',
    accent: 'from-emerald-500 to-teal-600',
    icon: '◉',
  },
}

const PROMPT_LIBRARY = [
  { icon: '✎', label: 'Rewrite', text: 'Rewrite the following in a clearer, more concise tone:\n\n' },
  { icon: '✺', label: 'Expand', text: 'Expand this into a detailed, well-structured essay:\n\n' },
  { icon: '⌘', label: 'Summarize', text: 'Summarize the key points of the following:\n\n' },
  { icon: '◐', label: 'Translate', text: 'Translate the following into natural, idiomatic English:\n\n' },
  { icon: '❖', label: 'Code', text: 'Write production-ready TypeScript for the following:\n\n' },
  { icon: '◇', label: 'Brainstorm', text: 'Give me 10 creative, non-obvious ideas about:\n\n' },
]

const QUICK_TAGS = ['Concise', 'Formal', 'Creative', 'Technical', 'Friendly']

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function TextMode() {
  const { currentProjectId } = useCurrentProject()

  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ModelId>('agnes-2.0-flash')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [projectName, setProjectName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState('')
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // ── Load history ────────────────────────────────────────
  useEffect(() => {
    if (!currentProjectId) return
    fetch(`/api/projects/${currentProjectId}`)
      .then((r) => r.json())
      .then((project) => {
        setProjectName(project.name ?? '')
        const items: HistoryItem[] = (project.generations ?? [])
          .filter((g: any) => g.mode === 'text')
          .map((g: any) => ({
            id: g.id,
            prompt: g.prompt,
            result: g.result,
            createdAt: g.created_at ?? g.createdAt,
            model: g.metadata?.model,
            tokens: g.metadata?.tokens,
          }))
        setHistory(items)
        setActiveId(items[0]?.id ?? null)
      })
      .catch(() => {})
  }, [currentProjectId])

  // ── Auto-resize textarea ────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 320) + 'px'
  }, [prompt])

  // ── Keyboard shortcut ───────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleGenerate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, model, temperature, maxTokens, systemPrompt, currentProjectId])

  // ── Generate ────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !currentProjectId || loading) return
    setLoading(true)
    setError(null)
    setStreaming('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'text',
          prompt,
          projectId: currentProjectId,
          model,
          temperature,
          max_tokens: maxTokens,
          system: systemPrompt || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message ?? 'Generation failed'
        )
      }

      const text = data.text ?? data.result ?? ''

      // Fake typewriter reveal for a premium feel
      await streamText(text, setStreaming)

      // Refresh full history from server
      const updated = await fetch(`/api/projects/${currentProjectId}`).then(
        (r) => r.json()
      )
      const items: HistoryItem[] = (updated.generations ?? [])
        .filter((g: any) => g.mode === 'text')
        .map((g: any) => ({
          id: g.id,
          prompt: g.prompt,
          result: g.result,
          createdAt: g.created_at ?? g.createdAt,
          model: g.metadata?.model,
          tokens: g.metadata?.tokens,
        }))
      setHistory(items)
      setActiveId(items[0]?.id ?? null)
      setStreaming('')
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [prompt, model, temperature, maxTokens, systemPrompt, currentProjectId, loading])

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history
    const q = searchQuery.toLowerCase()
    return history.filter(
      (h) =>
        h.prompt.toLowerCase().includes(q) ||
        h.result.toLowerCase().includes(q)
    )
  }, [history, searchQuery])

  const active = history.find((h) => h.id === activeId) ?? null

  function applyLibrary(text: string) {
    setPrompt((p) => text + p)
    textareaRef.current?.focus()
  }

  function appendTag(tag: string) {
    setPrompt((p) => (p ? `${p}\n\nStyle: ${tag}` : `Style: ${tag}`))
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  const activeModel = MODELS[model]
  const outputText = streaming || active?.result || ''
  const isStreaming = loading || !!streaming

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-y-auto">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* ── Header ──────────────────────────────────────── */}
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-fuchsia-500 flex items-center justify-center text-xl font-bold shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                ⌘
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 blur-lg opacity-40 -z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                Text Studio
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Neural language synthesis ·{' '}
                <span className="text-neutral-300 font-mono">
                  {projectName || 'untitled project'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] font-mono text-[10px] text-neutral-500">
              <span>CTX 128k</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>STREAM ON</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>{history.length} RUNS</span>
            </div>
          </div>
        </header>

        {/* ── Main grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* LEFT */}
          <div className="space-y-5 min-w-0">
            {/* Model selector */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(MODELS) as ModelId[]).map((m) => {
                  const info = MODELS[m]
                  const isActive = model === m
                  return (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      className={`group relative flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 overflow-hidden ${
                        isActive
                          ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-transparent'
                          : 'border-white/5 bg-white/[0.01] hover:border-white/15'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${info.accent} flex items-center justify-center text-sm shrink-0 ${
                          isActive ? 'shadow-lg' : 'opacity-70 group-hover:opacity-100'
                        } transition-opacity`}
                      >
                        {info.icon}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-semibold text-neutral-200 truncate">
                          {info.label}
                        </p>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {info.speed}
                        </p>
                      </div>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Prompt card */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    Prompt
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    {prompt.length} chars
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAdvanced((v) => !v)}
                    className={`text-[10px] uppercase tracking-widest transition-colors ${
                      showAdvanced
                        ? 'text-blue-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    ⚙ Advanced
                  </button>
                  {prompt && (
                    <button
                      onClick={() => setPrompt('')}
                      className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate…  ⌘↵ to run"
                rows={4}
                className="w-full bg-transparent px-5 py-4 text-sm placeholder:text-neutral-600 focus:outline-none resize-none leading-relaxed min-h-[120px]"
              />

              {/* Quick tags */}
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => appendTag(tag)}
                    className="text-[10px] px-2 py-1 rounded-full border border-white/5 bg-white/[0.02] text-neutral-400 hover:border-blue-500/40 hover:text-blue-300 transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              {/* Advanced */}
              {showAdvanced && (
                <div className="border-t border-white/5 p-4 space-y-4 bg-black/20">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                      System Prompt
                    </label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Optional — sets persona / rules for the model…"
                      rows={2}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Slider
                      label="Temperature"
                      value={temperature}
                      display={temperature.toFixed(2)}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={setTemperature}
                    />
                    <Slider
                      label="Max Tokens"
                      value={maxTokens}
                      display={`${maxTokens}`}
                      min={128}
                      max={8192}
                      step={128}
                      onChange={setMaxTokens}
                    />
                  </div>
                </div>
              )}

              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                  <span className="font-mono">
                    MODEL ·{' '}
                    <span className="text-neutral-300">{activeModel.label}</span>
                  </span>
                  <span className="w-1 h-1 rounded-full bg-neutral-700" />
                  <span className="font-mono">
                    EST ·{' '}
                    <span className="text-emerald-400">
                      ~{Math.max(1, Math.ceil(prompt.length / 300))}s
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-neutral-600 font-mono">
                  ⌘ + ↵
                </span>
              </div>
            </div>

            {/* Prompt library */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase tracking-widest text-neutral-500">
                  Prompt Library
                </h3>
                <span className="text-[10px] font-mono text-neutral-600">
                  {PROMPT_LIBRARY.length} presets
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROMPT_LIBRARY.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyLibrary(p.text)}
                    className="group flex items-center gap-2 p-2.5 rounded-lg border border-white/5 bg-white/[0.01] hover:border-blue-500/40 hover:bg-white/[0.03] transition-all text-left"
                  >
                    <span className="text-sm text-neutral-400 group-hover:text-blue-400 transition-colors">
                      {p.icon}
                    </span>
                    <span className="text-xs text-neutral-300 truncate">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || !currentProjectId}
              className="group relative w-full py-3.5 rounded-xl text-sm font-semibold overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-fuchsia-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <span>◈</span>
                    Generate
                    <span className="text-[10px] font-mono opacity-70">
                      {activeModel.speed}
                    </span>
                  </>
                )}
              </span>
            </button>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex items-start gap-2">
                <span className="text-red-500">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Result / Streaming */}
            {(streaming || active) && (
              <div
                ref={resultRef}
                className="relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden"
              >
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-500/40 rounded-tl-2xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-500/40 rounded-tr-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-500/40 rounded-bl-2xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-500/40 rounded-br-2xl pointer-events-none" />

                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isStreaming
                          ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse'
                          : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      }`}
                    />
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                      {isStreaming ? 'Streaming' : 'Output'}
                    </span>
                    {active?.model && !streaming && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span className="text-[10px] font-mono text-neutral-500">
                          {active.model}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View mode toggle */}
                    <div className="flex items-center rounded-md border border-white/10 bg-white/[0.02] p-0.5">
                      {(['rendered', 'raw'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded transition-all ${
                            viewMode === m
                              ? 'bg-white/10 text-white'
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {m === 'rendered' ? '◈ MD' : '⌨ Raw'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        copy(outputText, active?.id ?? 'live')
                      }
                      className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-blue-300 transition-colors"
                    >
                      {copiedId === (active?.id ?? 'live')
                        ? '✓ Copied'
                        : '⧉ Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {viewMode === 'rendered' ? (
                    <Markdown content={outputText} streaming={isStreaming} />
                  ) : (
                    <pre className="text-[13px] leading-relaxed font-mono text-neutral-300 whitespace-pre-wrap">
                      {outputText}
                    </pre>
                  )}
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-neutral-500 text-sm">⌕</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history…"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            {/* History */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-neutral-400">
                  History
                </h3>
                <span className="text-[10px] font-mono text-neutral-600">
                  {filteredHistory.length}
                  {searchQuery && ` / ${history.length}`}
                </span>
              </div>

              <div className="max-h-[520px] overflow-y-auto p-2 space-y-1.5">
                {filteredHistory.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center mb-3">
                      ◈
                    </div>
                    <p className="text-xs text-neutral-500">
                      {searchQuery ? 'No matches' : 'No generations yet'}
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-1">
                      {searchQuery
                        ? 'Try a different query'
                        : 'Run your first prompt'}
                    </p>
                  </div>
                )}
                {filteredHistory.map((h) => {
                  const isActive = activeId === h.id
                  return (
                    <button
                      key={h.id}
                      onClick={() => {
                        setActiveId(h.id)
                        setStreaming('')
                      }}
                      className={`group w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden ${
                        isActive
                          ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/[0.08] to-transparent'
                          : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-cyan-500" />
                      )}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-mono text-neutral-500">
                          {format(new Date(h.createdAt), 'MMM d · HH:mm')}
                        </span>
                        {h.model && (
                          <span className="text-[9px] uppercase tracking-widest text-neutral-600">
                            {h.model.split('-').slice(-1)[0]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300 line-clamp-2 leading-snug">
                        {h.prompt}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Telemetry */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-[10px] uppercase tracking-widest text-neutral-400">
                Session
              </h3>
              <div className="space-y-2.5">
                <Metric label="Runs" value={String(history.length)} />
                <Metric
                  label="Total chars"
                  value={String(
                    history.reduce((n, h) => n + h.result.length, 0)
                  )}
                />
                <Metric
                  label="Active model"
                  value={activeModel.label}
                  accent="text-blue-400"
                />
                <Metric
                  label="Avg latency"
                  value={activeModel.speed}
                  accent="text-emerald-400"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }, [text])

  return (
    <button
      onClick={onCopy}
      className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest font-mono bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200 border border-white/10 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  )
}

const Markdown = memo(function Markdown({
  content,
  streaming = false,
}: {
  content: string
  streaming?: boolean
}) {
  return (
    <div className="md-body text-[15px] leading-relaxed text-neutral-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={streaming ? [] : [rehypeHighlight]}
        components={{
          // ── Headings ────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-8 mb-4 text-white tracking-tight first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-7 mb-3 text-white tracking-tight flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-cyan-500" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-6 mb-2 text-neutral-100">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-4 mb-2 text-neutral-200">
              {children}
            </h4>
          ),

          // ── Paragraphs ──────────────────────────────────
          p: ({ children }) => (
            <p className="my-3 leading-relaxed text-neutral-300">{children}</p>
          ),

          // ── Lists ───────────────────────────────────────
          ul: ({ children }) => (
            <ul className="my-3 space-y-1.5 pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-1.5 pl-6 list-decimal marker:text-blue-400 marker:font-mono marker:text-xs">
              {children}
            </ol>
          ),
          li: ({ children, ...props }: any) => {
            const ordered = props.ordered
            return (
              <li
                className={
                  ordered
                    ? 'text-neutral-300 pl-1'
                    : 'text-neutral-300 flex items-start gap-2.5 before:content-["▸"] before:text-blue-400 before:mt-0.5 before:text-xs before:shrink-0'
                }
              >
                {children}
              </li>
            )
          },

          // ── Inline & block code ─────────────────────────
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const codeText = String(children).replace(/\n$/, '')

            if (inline || !match) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <div className="group relative my-4 rounded-xl border border-white/10 bg-[#0a0c14] overflow-hidden">
                {/* Language bar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    <span className="ml-3 text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
                      {match[1]}
                    </span>
                  </div>
                </div>
                <CopyCodeButton text={codeText} />
                <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            )
          },

          // ── Blockquote ──────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 py-1 border-l-2 border-blue-500/40 bg-blue-500/[0.03] rounded-r-lg italic text-neutral-400">
              {children}
            </blockquote>
          ),

          // ── Links ───────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/40 hover:decoration-blue-400 transition-colors"
            >
              {children}
            </a>
          ),

          // ── Horizontal rule ─────────────────────────────
          hr: () => (
            <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          ),

          // ── Tables ──────────────────────────────────────
          table: ({ children }) => (
            <div className="my-4 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/[0.03] text-neutral-300">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold text-neutral-400 border-b border-white/5">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-neutral-300 border-b border-white/5">
              {children}
            </td>
          ),

          // ── Images ──────────────────────────────────────
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ''}
              className="my-4 rounded-xl border border-white/10 max-w-full"
            />
          ),

          // ── Strong / em ─────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-200">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────
// Helpers & small components
// ─────────────────────────────────────────────────────────────

async function streamText(
  text: string,
  setter: (v: string) => void,
  delay = 12
) {
  const chunkSize = Math.max(2, Math.ceil(text.length / 240))
  let i = 0
  while (i < text.length) {
    i = Math.min(text.length, i + chunkSize)
    setter(text.slice(0, i))
    await new Promise((r) => setTimeout(r, delay))
  }
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-widest text-neutral-500">
          {label}
        </label>
        <span className="text-xs font-mono text-blue-400">{display}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(96,165,250,0.8)] pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  accent = 'text-neutral-200',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <span className={`text-xs font-mono ${accent}`}>{value}</span>
    </div>
  )
}