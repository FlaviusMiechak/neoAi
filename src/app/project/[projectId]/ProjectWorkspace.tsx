// src/app/project/[projectId]/ProjectWorkspace.tsx
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { ProjectWithGenerations } from '@/lib/projects'
import type {
  Generation,
  GenerationMode,
  EnrichedGeneration,
} from '@/lib/generation-types'
import { withParsedMetadata } from '@/lib/generation-types'
import { format } from 'date-fns'

type Quality = '144p' | '244p' | '360p' | '480p' | '720p' | '1080p' | '4k'
type MergeMode = 'intro' | 'watermark' | 'side-by-side' | 'split'

interface UIGeneration extends EnrichedGeneration {
  mergedVideoUrl?: string
}

const MODE_ICONS: Record<string, string> = {
  all: '◈',
  text: '⌘',
  image: '▣',
  audio: '◉',
  video: '▶',
}

const MODE_ACCENTS: Record<string, string> = {
  text: 'from-cyan-500 to-blue-600',
  image: 'from-fuchsia-500 to-purple-600',
  audio: 'from-amber-500 to-orange-600',
  video: 'from-emerald-500 to-teal-600',
}

export default function ProjectWorkspace({
  project,
}: {
  project: ProjectWithGenerations
}) {
  const safeGenerations: UIGeneration[] = Array.isArray(project?.generations)
    ? project.generations.map((g) => ({
        ...withParsedMetadata(g as Generation),
      }))
    : []

  const [generations, setGenerations] = useState<UIGeneration[]>(safeGenerations)
  const [filter, setFilter] = useState<GenerationMode | 'all'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(
    safeGenerations[0]?.id ?? null
  )
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let list =
      filter === 'all'
        ? generations
        : generations.filter((g) => g.mode === filter)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((g) => g.prompt.toLowerCase().includes(q))
    }

    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sort === 'newest' ? tb - ta : ta - tb
    })
  }, [generations, filter, sort, searchQuery])

  const selected = generations.find((g) => g.id === selectedId) ?? null

  const modeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generations.length }
    for (const g of generations) {
      counts[g.mode] = (counts[g.mode] || 0) + 1
    }
    return counts
  }, [generations])

  function updateGeneration(id: string, patch: Partial<UIGeneration>) {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    )
  }

  return (
    <div className="min-h-screen bg-[#05060a] text-neutral-100 relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-white/[0.02] sticky top-0 z-20">
          <div className="max-w-[1600px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                {/* Project badge */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                    <span className="text-xl font-bold">◈</span>
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 blur-lg opacity-40 -z-10" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent truncate">
                      {project?.name ?? 'Untitled Project'}
                    </h1>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Live
                    </span>
                  </div>
                  {project?.description && (
                    <p className="text-sm text-neutral-400 mt-0.5 truncate max-w-2xl">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden lg:flex items-center gap-6">
                <StatChip label="Assets" value={String(safeGenerations.length)} />
                <StatChip
                  label="Modes"
                  value={String(Object.keys(modeCounts).length - 1)}
                />
                <StatChip
                  label="Created"
                  value={format(new Date(project?.created_at ?? Date.now()), 'MMM d')}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 p-6">
          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden flex flex-col">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-neutral-500 text-sm">⌕</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts…"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-3">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'text', 'image', 'audio', 'video'] as const).map(
                  (m) => {
                    const active = filter === m
                    const count = modeCounts[m] ?? 0
                    return (
                      <button
                        key={m}
                        onClick={() => setFilter(m)}
                        className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 ${
                          active
                            ? 'border-blue-500/50 bg-blue-500/10 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                            : 'border-white/5 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
                        }`}
                      >
                        <span className="text-sm">{MODE_ICONS[m]}</span>
                        <span className="capitalize">{m}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-blue-500/30 text-blue-200'
                              : 'bg-white/5 text-neutral-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  }
                )}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 uppercase tracking-wider">
                Sort
              </span>
              <div className="flex-1 flex rounded-lg border border-white/5 bg-white/[0.02] p-0.5">
                {(['newest', 'oldest'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-all ${
                      sort === s
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {s === 'newest' ? '↓ Newest' : '↑ Oldest'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 scrollbar-thin">
              {filtered.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <p className="text-sm text-neutral-500">No matches</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Try adjusting filters
                  </p>
                </div>
              )}
              {filtered.map((g) => {
                const active = selectedId === g.id
                const accent = MODE_ACCENTS[g.mode] ?? 'from-neutral-500 to-neutral-600'
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`group w-full text-left p-3 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                      active
                        ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/[0.08] to-transparent'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                    }`}
                  >
                    {active && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-cyan-500" />
                    )}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-md bg-gradient-to-br ${accent} flex items-center justify-center text-[10px] font-bold`}
                        >
                          {MODE_ICONS[g.mode] ?? '◆'}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                          {g.mode}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {format(new Date(g.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 text-neutral-300 leading-snug">
                      {g.prompt}
                    </p>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-[60vh] border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center text-2xl mb-4">
                  ◈
                </div>
                <p className="text-neutral-400 text-sm">
                  Select a generation to preview
                </p>
                <p className="text-neutral-600 text-xs mt-1">
                  Choose from the library on the left
                </p>
              </div>
            ) : (
              <PreviewPanel
                generation={selected}
                allGenerations={generations}
                onUpdate={(patch) => updateGeneration(selected.id, patch)}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="text-sm font-semibold text-neutral-200 font-mono">{value}</p>
    </div>
  )
}

/* ---------- Preview + tools ---------- */

function PreviewPanel({
  generation,
  allGenerations,
  onUpdate,
}: {
  generation: UIGeneration
  allGenerations: UIGeneration[]
  onUpdate: (patch: Partial<UIGeneration>) => void
}) {
  const [quality, setQuality] = useState<Quality>('720p')
  const [showMerger, setShowMerger] = useState(false)

  const availableImages = allGenerations.filter((g) => g.mode === 'image')
  const availableVideos = allGenerations.filter((g) => g.mode === 'video')
  const accent = MODE_ACCENTS[generation.mode] ?? 'from-neutral-500 to-neutral-600'

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Meta card */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-lg font-bold shrink-0 shadow-lg`}
            >
              {MODE_ICONS[generation.mode] ?? '◆'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                  {generation.mode} generation
                </span>
                <span className="w-1 h-1 rounded-full bg-neutral-600" />
                <span className="text-[10px] text-neutral-500 font-mono">
                  {generation.id.slice(0, 8)}
                </span>
              </div>
              <h2 className="text-base font-semibold text-neutral-100 leading-snug">
                {generation.prompt}
              </h2>
              <p className="text-xs text-neutral-500 mt-1.5 font-mono">
                {format(new Date(generation.created_at), 'PPPP · p')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03]">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                Res
              </span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="bg-transparent text-sm text-neutral-200 focus:outline-none cursor-pointer"
              >
                <option className="bg-neutral-900" value="144p">144p</option>
                <option className="bg-neutral-900" value="244p">244p</option>
                <option className="bg-neutral-900" value="360p">360p</option>
                <option className="bg-neutral-900" value="480p">480p</option>
                <option className="bg-neutral-900" value="720p">720p</option>
                <option className="bg-neutral-900" value="1080p">1080p</option>
                <option className="bg-neutral-900" value="4k">4K</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Playback area */}
      <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/40 rounded-tl-2xl z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/40 rounded-tr-2xl z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/40 rounded-bl-2xl z-10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/40 rounded-br-2xl z-10 pointer-events-none" />

        {generation.mode === 'text' && (
          <div className="p-8 text-neutral-200 whitespace-pre-wrap leading-relaxed text-[15px] max-h-[70vh] overflow-y-auto">
            {generation.result}
          </div>
        )}

        {generation.mode === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={generation.result}
            alt={generation.prompt}
            className="w-full h-auto object-contain max-h-[70vh] mx-auto"
          />
        )}

        {generation.mode === 'audio' && (
          <div className="p-10 bg-gradient-to-br from-amber-950/20 to-transparent">
            <AudioPlayer src={generation.result} />
          </div>
        )}

        {generation.mode === 'video' && (
          <VideoPlayer
            src={generation.mergedVideoUrl || generation.result}
            poster={generation.metadataObj?.thumbnail as string | undefined}
            quality={quality}
          />
        )}
      </div>

      {/* Merger */}
      {(generation.mode === 'video' || generation.mode === 'image') && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm">
                ⧉
              </div>
              <div>
                <h3 className="font-semibold text-sm">Composition Studio</h3>
                <p className="text-xs text-neutral-500">
                  Merge image + video with cinematic modes
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMerger((v) => !v)}
              className={`px-4 py-2 text-xs rounded-lg border transition-all ${
                showMerger
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-transparent bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]'
              }`}
            >
              {showMerger ? 'Close' : 'Open Studio'}
            </button>
          </div>

          {showMerger && (
            <div className="px-5 pb-5 border-t border-white/5 pt-5">
              <MergerPanel
                generation={generation}
                availableImages={availableImages}
                availableVideos={availableVideos}
                onUpdate={onUpdate}
              />
            </div>
          )}

          {generation.mergedVideoUrl && !showMerger && (
            <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-emerald-400">
                  ⬤ Merged output ready
                </p>
                <a
                  href={generation.mergedVideoUrl}
                  download
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ⬇ Download
                </a>
              </div>
              <video
                src={generation.mergedVideoUrl}
                controls
                className="w-full rounded-xl bg-black border border-white/10"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Video player ---------- */

function VideoPlayer({
  src,
  poster,
  quality,
}: {
  src: string
  poster?: string
  quality: Quality
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    ref.current?.load()
  }, [src, quality])

  return (
    <div className="relative">
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        playsInline
        onCanPlay={() => setReady(true)}
        className="w-full h-auto max-h-[70vh] bg-black"
      />
      <div className="absolute top-4 right-4 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md bg-black/70 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
        ● {quality}
      </div>
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-xs text-neutral-400 mt-3 tracking-widest uppercase">
            Loading
          </p>
        </div>
      )}
    </div>
  )
}

/* ---------- Audio player ---------- */

function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  function toggle() {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  function onTimeUpdate() {
    const el = ref.current
    if (!el) return
    setCurrent(el.currentTime)
    setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0)
  }

  function onLoaded() {
    const el = ref.current
    if (!el) return
    setDuration(el.duration)
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    el.currentTime = pct * el.duration
  }

  function fmt(s: number) {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-4">
      <audio
        ref={ref}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoaded}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:scale-105 transition-transform shrink-0"
      >
        <span className="text-lg">{playing ? '❚❚' : '▶'}</span>
      </button>
      <div className="flex-1 space-y-2">
        <div
          onClick={seek}
          className="h-1.5 rounded-full bg-white/10 cursor-pointer relative overflow-hidden group"
        >
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-neutral-500">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- Merger panel ---------- */

function MergerPanel({
  generation,
  availableImages,
  availableVideos,
  onUpdate,
}: {
  generation: UIGeneration
  availableImages: UIGeneration[]
  availableVideos: UIGeneration[]
  onUpdate: (patch: Partial<UIGeneration>) => void
}) {
  const defaultImage =
    generation.mode === 'image' ? generation : availableImages[0]
  const defaultVideo =
    generation.mode === 'video' ? generation : availableVideos[0]

  const [imageId, setImageId] = useState<string>(defaultImage?.id ?? '')
  const [videoId, setVideoId] = useState<string>(defaultVideo?.id ?? '')
  const [mode, setMode] = useState<MergeMode>('intro')
  const [introDuration, setIntroDuration] = useState(3)
  const [imagePosition, setImagePosition] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('top-right')
  const [imageScale, setImageScale] = useState(0.2)
  const [opacity, setOpacity] = useState(0.9)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedImage = availableImages.find((i) => i.id === imageId)
  const selectedVideo = availableVideos.find((v) => v.id === videoId)

  async function merge() {
    if (!selectedImage || !selectedVideo) {
      setError('Pick both an image and a video.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/video/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedImage.result,
          videoUrl: selectedVideo.result,
          mode,
          introDuration,
          imagePosition,
          imageScale,
          opacity,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Merge failed')
      }
      onUpdate({ mergedVideoUrl: data.url })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex items-start gap-2">
          <span className="text-red-500">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Source pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourcePicker
          label="Image Source"
          icon="▣"
          accent="from-fuchsia-500 to-purple-600"
          items={availableImages}
          value={imageId}
          onChange={setImageId}
          previewType="image"
        />
        <SourcePicker
          label="Video Source"
          icon="▶"
          accent="from-emerald-500 to-teal-600"
          items={availableVideos}
          value={videoId}
          onChange={setVideoId}
          previewType="video"
        />
      </div>

      {/* Mode */}
      <section className="space-y-3">
        <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          Composition Mode
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {(
            [
              { value: 'intro', label: 'Intro card', hint: 'Image → video', icon: '⏵' },
              { value: 'watermark', label: 'Watermark', hint: 'Overlay image', icon: '◐' },
              { value: 'side-by-side', label: 'Side by side', hint: 'Split horizontally', icon: '◫' },
              { value: 'split', label: 'Split screen', hint: 'Stack vertically', icon: '⬓' },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`relative text-left rounded-xl border p-3 transition-all duration-200 overflow-hidden group ${
                  active
                    ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-transparent'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-base ${
                      active ? 'text-blue-400' : 'text-neutral-500'
                    }`}
                  >
                    {opt.icon}
                  </span>
                  <p className="text-xs font-medium text-neutral-200">
                    {opt.label}
                  </p>
                </div>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  {opt.hint}
                </p>
                {active && (
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Options */}
      {(mode === 'intro' || mode === 'watermark') && (
        <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
          {mode === 'intro' && (
            <Slider
              label="Intro duration"
              value={introDuration}
              display={`${introDuration}s`}
              min={1}
              max={10}
              step={0.5}
              onChange={setIntroDuration}
            />
          )}

          {mode === 'watermark' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                  Position
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
                  ).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setImagePosition(pos)}
                      className={`aspect-square rounded-lg border transition-all ${
                        imagePosition === pos
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="w-full h-full p-2 flex items-center justify-center">
                        <div className="w-full h-full rounded-sm bg-neutral-700/50 relative">
                          <div
                            className={`absolute w-2 h-2 rounded-sm bg-blue-400 ${
                              pos === 'top-left'
                                ? 'top-0.5 left-0.5'
                                : pos === 'top-right'
                                ? 'top-0.5 right-0.5'
                                : pos === 'bottom-left'
                                ? 'bottom-0.5 left-0.5'
                                : 'bottom-0.5 right-0.5'
                            }`}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Slider
                label="Size"
                value={imageScale}
                display={`${Math.round(imageScale * 100)}%`}
                min={0.05}
                max={0.5}
                step={0.01}
                onChange={setImageScale}
              />
              <Slider
                label="Opacity"
                value={opacity}
                display={`${Math.round(opacity * 100)}%`}
                min={0.1}
                max={1}
                step={0.05}
                onChange={setOpacity}
              />
            </>
          )}
        </section>
      )}

      {/* Merge button */}
      <button
        onClick={merge}
        disabled={busy || !selectedImage || !selectedVideo}
        className="group relative w-full py-3 rounded-xl text-sm font-semibold overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 group-hover:scale-105 transition-transform" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
        <span className="relative flex items-center justify-center gap-2">
          {busy ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Rendering…
            </>
          ) : (
            <>
              <span>⧉</span>
              Merge Image + Video
            </>
          )}
        </span>
      </button>
      <p className="text-[10px] text-neutral-500 text-center tracking-wide">
        Merged output will be saved to this project
      </p>
    </div>
  )
}

function SourcePicker({
  label,
  icon,
  accent,
  items,
  value,
  onChange,
  previewType,
}: {
  label: string
  icon: string
  accent: string
  items: UIGeneration[]
  value: string
  onChange: (v: string) => void
  previewType: 'image' | 'video'
}) {
  const selected = items.find((i) => i.id === value)

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-br ${accent} flex items-center justify-center text-[10px]`}
        >
          {icon}
        </div>
        <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
          {label}
        </h4>
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
        >
          <option className="bg-neutral-900" value="">
            — Select {previewType} —
          </option>
          {items.map((item) => (
            <option className="bg-neutral-900" key={item.id} value={item.id}>
              {item.prompt.slice(0, 60)}
              {item.prompt.length > 60 ? '…' : ''}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none text-xs">
          ▾
        </span>
      </div>
      {selected &&
        (previewType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.result}
            alt="preview"
            className="w-full h-28 object-cover rounded-lg border border-white/10"
          />
        ) : (
          <video
            src={selected.result}
            muted
            className="w-full h-28 object-cover rounded-lg border border-white/10 bg-black"
          />
        ))}
    </section>
  )
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