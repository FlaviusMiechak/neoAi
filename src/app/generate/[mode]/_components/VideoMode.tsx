// src/app/generate/[mode]/_components/VideoMode.tsx
'use client'

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import {
  useRequireProject,
  useCurrentProject,
} from '@/lib/useCurrentProject'
import { ProjectPickerModal } from '@/components/ProjectPickerModal'
import { format } from 'date-fns'
import {
  type StudioAsset,
  type AssetKind,
  type Shot,
  type StoryCharacter,
  VIDEO_MODELS,
  CHARACTER_PROFILES,
  ASPECTS,
  STYLES,
  STORY_FORMATS,
  validateFile,
  kindFromMime,
  projectGenerationsToAssets,
  fetchProjectGenerations,
} from '@/lib/video-studio'

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function VideoMode() {
  const { ready, needsProject, project, currentProjectId } = useRequireProject()
  const { refreshProject: refreshCurrentProject } = useCurrentProject()

  // ── Composer state ───────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(VIDEO_MODELS[0].id as string)
  const [aspect, setAspect] = useState<typeof ASPECTS[number]['id']>('16:9')
  const [duration, setDuration] = useState(6)
  const [style, setStyle] = useState<string>('Cinematic')
  const [storyFormats, setStoryFormats] = useState<string[]>([])
  const [seed, setSeed] = useState<number | ''>('')
  const [characterProfile, setCharacterProfile] = useState({
    enabled: false,
    role: 'any' as 'any' | 'actor' | 'actress',
    characters: [] as StoryCharacter[],
    notes: '',
  })

  // ── Assets & UI ──────────────────────────────────────────
  const [uploads, setUploads] = useState<StudioAsset[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  // ── Shots ────────────────────────────────────────────────
  const [shots, setShots] = useState<Shot[]>([])
  const [activeShotId, setActiveShotId] = useState<string | null>(null)

  // ── UI flags ─────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // ── Remote generations ───────────────────────────────────
  const [remoteGens, setRemoteGens] = useState<any[]>([])
  const [loadingGens, setLoadingGens] = useState(false)

  const pollers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Toast helper ─────────────────────────────────────────
  const notify = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }, [])

  // ── Fetch generations ────────────────────────────────────
  useEffect(() => {
    if (!currentProjectId) {
      setRemoteGens([])
      return
    }
    let cancelled = false
    setLoadingGens(true)

    fetchProjectGenerations(currentProjectId)
      .then((rows) => {
        if (cancelled) return
        setRemoteGens(rows)
      })
      .finally(() => {
        if (!cancelled) setLoadingGens(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentProjectId])

  // ── Manual refresh ───────────────────────────────────────
  const reloadGenerations = useCallback(async () => {
    if (!currentProjectId) return []
    setLoadingGens(true)
    try {
      const rows = await fetchProjectGenerations(currentProjectId)
      setRemoteGens(rows)
      return rows
    } finally {
      setLoadingGens(false)
    }
  }, [currentProjectId])

  // ── Merge remote gens with hook data ─────────────────────
  const sourceGenerations = useMemo<any[]>(() => {
    if (remoteGens.length > 0) return remoteGens
    return (project?.generations ?? []) as any[]
  }, [remoteGens, project?.generations])

  const projectAssets = useMemo<StudioAsset[]>(
    () => projectGenerationsToAssets(sourceGenerations as any),
    [sourceGenerations]
  )
  const selectedLibraryAssets = useMemo(
    () => uploads.filter((asset) => asset.source === 'project'),
    [uploads]
  )

  const isBusy = shots.some(
    (s) => s.status === 'queued' || s.status === 'processing'
  )

  // ── Seed shots from history ──────────────────────────────
  useEffect(() => {
    if (!project) return
    const prior: Shot[] = (project.generations ?? [])
      .filter((g) => g.mode === 'video')
      .reverse()
      .map((g) => {
        const ts = g.createdAt ? new Date(g.createdAt).getTime() : Date.now()
        return {
          id: g.id,
          generationId: g.id,
          prompt: g.prompt,
          status: 'done' as const,
          videoUrl: g.result,
          ingredients: [],
          createdAt: isNaN(ts) ? Date.now() : ts,
          model: VIDEO_MODELS[0].id,
          duration: 16,
          aspect: '16:9',
        }
      })
    setShots(prior)
    setActiveShotId(prior[prior.length - 1]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  // ── Auto-scroll on new shot ──────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [shots.length])

  // ── Pollers cleanup ──────────────────────────────────────
  useEffect(() => {
    const map = pollers.current
    return () => {
      map.forEach((p) => clearInterval(p))
      map.clear()
    }
  }, [])

  // ── Project picker sync ──────────────────────────────────
  useEffect(() => {
    if (needsProject) setPickerOpen(true)
  }, [needsProject])

  useEffect(() => {
    if (ready) setPickerOpen(false)
  }, [ready])

  // ─────────────────────────────────────────────────────────
  // Uploads
  // ─────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      const accepted: StudioAsset[] = []
      const rejected: string[] = []

      for (const file of arr) {
        const kind = kindFromMime(file.type)
        if (!kind) {
          rejected.push(`${file.name} — unknown type`)
          continue
        }
        const err = validateFile(file, kind)
        if (err) {
          rejected.push(`${file.name} — ${err}`)
          continue
        }

        const objectUrl = URL.createObjectURL(file)
        const asset: StudioAsset = {
          id: `up-${crypto.randomUUID()}`,
          kind,
          url: objectUrl,
          name: file.name,
          size: file.size,
          mime: file.type,
          source: 'upload',
          status: 'uploading',
          progress: 0,
        }
        if (kind === 'image') asset.preview = objectUrl
        accepted.push(asset)
      }

      if (rejected.length) {
        notify(
          `Skipped: ${rejected[0]}${
            rejected.length > 1 ? ` (+${rejected.length - 1} more)` : ''
          }`
        )
      }
      if (!accepted.length) return

      setUploads((prev) => [...prev, ...accepted])

      for (const asset of accepted) {
        const file = arr.find(
          (f) => f.size === asset.size && f.type === asset.mime
        )
        if (!file) continue

        const ticker = setInterval(() => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === asset.id && u.status === 'uploading'
                ? { ...u, progress: Math.min(90, (u.progress ?? 0) + 15) }
                : u
            )
          )
        }, 200)

        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('kind', asset.kind)
          if (currentProjectId) fd.append('projectId', currentProjectId)

          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Upload failed')

          setUploads((prev) =>
            prev.map((u) =>
              u.id === asset.id
                ? {
                    ...u,
                    url: data.url || u.url,
                    status: 'ready',
                    progress: 100,
                    generationId: data.generationId,
                  }
                : u
            )
          )

          void reloadGenerations()
        } catch (e: any) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === asset.id
                ? { ...u, status: 'error', error: e.message }
                : u
            )
          )
          notify(`Upload failed: ${e.message}`)
        } finally {
          clearInterval(ticker)
        }
      }
    },
    [currentProjectId, notify, reloadGenerations]
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  function removeAsset(id: string) {
    setUploads((prev) => {
      const a = prev.find((u) => u.id === id)
      if (a?.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
      return prev.filter((u) => u.id !== id)
    })
  }

  // ─────────────────────────────────────────────────────────
  // Shot generation
  // ─────────────────────────────────────────────────────────

  const createShot = useCallback(async () => {
    if (!prompt.trim() || !currentProjectId) return

    const selectedIngredients: StudioAsset[] = [
      ...uploads.filter((u) => u.status === 'ready'),
    ]

    const shot: Shot = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      status: 'queued',
      progress: 0,
      ingredients: selectedIngredients,
      createdAt: Date.now(),
      model,
      duration,
      aspect,
      style,
      storyFormats,
      characters: characterProfile.characters,
    }

    setShots((prev) => [...prev, shot])
    setActiveShotId(shot.id)
    setPrompt('')
    setUploads([])

    try {
      const body = {
        action: 'create',
        prompt: shot.prompt,
        projectId: currentProjectId,
        model: shot.model,
        aspect: shot.aspect,
        duration: shot.duration,
        style: shot.style,
        storyFormats: shot.storyFormats,
        seed: seed === '' ? undefined : Number(seed),
        characterProfile,
        ingredients: shot.ingredients.map((i) => ({
          kind: i.kind,
          url: i.url,
          name: i.name,
          generationId: i.generationId,
        })),
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : JSON.stringify(data.error)
        )
      }
      const videoId = data.videoId
      if (!videoId) throw new Error('No videoId returned')

      setShots((prev) =>
        prev.map((s) =>
          s.id === shot.id ? { ...s, status: 'processing', progress: 2 } : s
        )
      )

      // ── Poll for status ─────────────────────────────────
      const started = Date.now()
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'status',
              videoId,
              projectId: currentProjectId,
              prompt: data.prompt ?? shot.prompt,
              model: shot.model,
              style: shot.style,
              storyFormats: shot.storyFormats,
              aspect: shot.aspect,
              duration: shot.duration,
              characterProfile,
              ingredients: shot.ingredients.map((ingredient) => ({
                kind: ingredient.kind,
                url: ingredient.url,
                name: ingredient.name,
                generationId: ingredient.generationId,
              })),
            }),
          })
          const s = await statusRes.json()
          const prog = typeof s.progress === 'number' ? s.progress : 0
          const elapsed = (Date.now() - started) / 1000
          const eta =
            prog > 5 ? Math.round(elapsed / (prog / 100) - elapsed) : undefined

          setShots((prev) =>
            prev.map((x) =>
              x.id === shot.id
                ? {
                    ...x,
                    status:
                      s.status === 'completed'
                        ? 'done'
                        : s.status === 'failed'
                          ? 'failed'
                          : 'processing',
                    progress: s.status === 'completed' ? 100 : prog,
                    eta,
                    videoUrl:
                      s.status === 'completed'
                        ? s.url ?? s.video_url ?? s.metadata?.url
                        : x.videoUrl,
                    generationId: s.id ?? s.generation_id ?? x.generationId,
                    error:
                      s.status === 'failed'
                        ? s.error ?? 'Generation failed'
                        : undefined,
                  }
                : x
            )
          )

          if (s.status === 'completed' || s.status === 'failed') {
            const p = pollers.current.get(shot.id)
            if (p) clearInterval(p)
            pollers.current.delete(shot.id)
            await Promise.all([refreshCurrentProject(), reloadGenerations()])
          }
        } catch (e) {
          console.error('[video poll]', e)
        }
      }, 3000)

      pollers.current.set(shot.id, interval)
    } catch (e: any) {
      setShots((prev) =>
        prev.map((s) =>
          s.id === shot.id
            ? { ...s, status: 'failed', error: e.message }
            : s
        )
      )
    }
  }, [
    prompt,
    currentProjectId,
    uploads,
    model,
    aspect,
    duration,
    style,
    storyFormats,
    seed,
    characterProfile,
    refreshCurrentProject,
    reloadGenerations,
  ])

  function deleteShot(id: string) {
    const p = pollers.current.get(id)
    if (p) {
      clearInterval(p)
      pollers.current.delete(id)
    }
    setShots((prev) => prev.filter((s) => s.id !== id))
    if (activeShotId === id) setActiveShotId(null)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      createShot()
    }
  }

  const readyUploads = uploads.filter((u) => u.status === 'ready')
  const totalVideos = shots.filter((s) => s.status === 'done').length
  const activeModel =
    VIDEO_MODELS.find((m) => m.id === model) ?? VIDEO_MODELS[0]

  if (!ready && !needsProject) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-neutral-400">
        <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#05060a] text-neutral-100">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md text-xs text-neutral-200 shadow-2xl animate-in fade-in">
          {toast}
        </div>
      )}

      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex-shrink-0 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/generate"
                className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
              >
                ← Studio
              </Link>
              <span className="text-neutral-700">/</span>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                ▶
              </div>
              <h1 className="text-base font-semibold tracking-tight">
                Video Studio
              </h1>
              {project && (
                <>
                  <span className="w-1 h-1 rounded-full bg-neutral-700" />
                  <span className="text-xs text-neutral-400 truncate max-w-[180px]">
                    {project.name}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] font-mono text-[10px] text-neutral-500">
                <span>{totalVideos} RENDERED</span>
                <span className="w-1 h-1 rounded-full bg-neutral-700" />
                <span>{isBusy ? 'BUSY' : 'IDLE'}</span>
              </div>
              <button
                onClick={() => setLibraryOpen(true)}
                className="text-xs text-neutral-300 hover:text-white rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] px-3 py-1.5 transition-all"
              >
                ◈ Library
                {projectAssets.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-mono text-blue-400">
                    {projectAssets.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPickerOpen(true)}
                className="text-xs text-neutral-300 hover:text-white rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] px-3 py-1.5 transition-all"
              >
                📂 {project ? 'Switch' : 'Select'} project
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Left: shot stream + composer ─────────── */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
                {shots.length === 0 && <EmptyState onPick={setPrompt} />}

                {shots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    active={shot.id === activeShotId}
                    onFocus={() => setActiveShotId(shot.id)}
                    onDelete={() => deleteShot(shot.id)}
                    notify={notify}
                  />
                ))}
                <div className="h-40" />
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-white/5 bg-black/40 backdrop-blur-xl">
              <div className="max-w-4xl mx-auto px-6 py-4 space-y-3">
                {dragging && (
                  <div className="absolute inset-x-0 bottom-full mb-2 mx-6 rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/5 backdrop-blur-sm p-6 text-center">
                    <p className="text-sm text-blue-300">
                      Drop files to add to your shot
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Images · Videos · Audio
                    </p>
                  </div>
                )}

                {readyUploads.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {readyUploads.map((u) => (
                      <IngredientChip
                        key={u.id}
                        asset={u}
                        onRemove={() => removeAsset(u.id)}
                      />
                    ))}
                  </div>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] focus-within:border-blue-500/50 transition-all"
                >
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Describe the shot — camera, lighting, motion, mood…  ⌘↵ to render"
                    rows={2}
                    className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-neutral-600 max-h-40"
                    onInput={(e) => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
                    }}
                  />

                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,video/*,audio/*"
                          multiple
                          className="hidden"
                          onChange={(e) =>
                            e.target.files && handleFiles(e.target.files)
                          }
                        />
                        <span className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
                          ⬆ Attach
                        </span>
                      </label>
                      <button
                        onClick={() => setLibraryOpen(true)}
                        className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
                      >
                        ◈ From library
                      </button>
                      <button
                        onClick={() => setShowAdvanced((v) => !v)}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          showAdvanced
                            ? 'text-blue-400 bg-blue-500/10'
                            : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                        }`}
                      >
                        ⚙ Options
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="hidden md:inline text-[10px] font-mono text-neutral-600">
                        {activeModel.speed}
                      </span>
                      <button
                        onClick={createShot}
                        disabled={!prompt.trim() || !ready || !currentProjectId}
                        className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all"
                      >
                        <span>▶</span>
                        Render
                      </button>
                    </div>
                  </div>

                  {showAdvanced && (
                    <div className="border-t border-white/5 p-4 space-y-4 bg-black/20">
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                          Model
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {VIDEO_MODELS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setModel(m.id)}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                                model === m.id
                                  ? 'border-blue-500/50 bg-blue-500/10'
                                  : 'border-white/5 hover:border-white/15'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-md bg-gradient-to-br ${m.accent} flex items-center justify-center text-xs`}
                              >
                                {m.icon}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {m.label}
                                </p>
                                <p className="text-[9px] text-neutral-500 truncate">
                                  {m.speed}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                              Character casting
                            </p>
                            <p className="text-[11px] text-neutral-400 mt-1">
                              Optional — these preferences help guide the cast
                              without forcing them into the story.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCharacterProfile((prev) => ({
                                ...prev,
                                enabled: !prev.enabled,
                              }))
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                              characterProfile.enabled
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                                : 'bg-white/[0.03] text-neutral-300 border border-white/10'
                            }`}
                          >
                            {characterProfile.enabled ? 'On' : 'Off'}
                          </button>
                        </div>

                        {characterProfile.enabled && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                              {(['any', 'actor', 'actress'] as const).map(
                                (role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    onClick={() =>
                                      setCharacterProfile((prev) => ({
                                        ...prev,
                                        role,
                                      }))
                                    }
                                    className={`rounded-lg border px-2 py-2 text-[10px] uppercase tracking-[0.12em] transition ${
                                      characterProfile.role === role
                                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-200'
                                        : 'border-white/10 bg-white/[0.02] text-neutral-300'
                                    }`}
                                  >
                                    {role === 'any' ? 'Any' : role}
                                  </button>
                                )
                              )}
                            </div>

                            <div className="space-y-2">
                              <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                                Character avatars
                              </p>
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                {CHARACTER_PROFILES.map((profile) => {
                                  const character = characterProfile.characters.find(
                                    (item) => item.origin === profile.id
                                  )
                                  return (
                                    <button
                                      key={profile.id}
                                      type="button"
                                      aria-pressed={Boolean(character)}
                                      onClick={() =>
                                        setCharacterProfile((prev) => {
                                          const exists = prev.characters.some(
                                            (item) => item.origin === profile.id
                                          )
                                          return {
                                            ...prev,
                                            characters: exists
                                              ? prev.characters.filter(
                                                  (item) => item.origin !== profile.id
                                                )
                                              : [
                                                  ...prev.characters,
                                                  {
                                                    origin: profile.id,
                                                    name: `Character ${prev.characters.length + 1}`,
                                                  },
                                                ],
                                          }
                                        })
                                      }
                                      className={`flex min-h-20 items-center gap-2 rounded-xl border p-2 text-left transition ${
                                        character
                                          ? 'border-fuchsia-400/50 bg-fuchsia-500/10 text-white'
                                          : 'border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20'
                                      }`}
                                    >
                                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${profile.tone}`}>
                                        <UserRound size={17} aria-hidden="true" />
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block text-[10px] font-medium">{profile.label}</span>
                                        <span className="block text-[9px] text-neutral-500">
                                          {character ? 'Selected' : 'Add character'}
                                        </span>
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                              {characterProfile.characters.length > 0 && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {characterProfile.characters.map((character) => {
                                    const profile = CHARACTER_PROFILES.find(
                                      (option) => option.id === character.origin
                                    )
                                    return (
                                      <label key={character.origin} className="space-y-1 text-[10px] text-neutral-500">
                                        {profile?.label} character name
                                        <input
                                          value={character.name}
                                          onChange={(event) =>
                                            setCharacterProfile((prev) => ({
                                              ...prev,
                                              characters: prev.characters.map((item) =>
                                                item.origin === character.origin
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                              ),
                                            }))
                                          }
                                          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-200 outline-none focus:border-blue-500/50"
                                        />
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                                Special notes
                              </label>
                              <textarea
                                value={characterProfile.notes}
                                onChange={(e) =>
                                  setCharacterProfile((prev) => ({
                                    ...prev,
                                    notes: e.target.value,
                                  }))
                                }
                                rows={2}
                                placeholder="Optional: warm, elegant, confident, etc."
                                className="w-full resize-none bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-blue-500/50"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                            Aspect
                          </p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {ASPECTS.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => setAspect(a.id)}
                                className={`text-[11px] py-2 rounded-lg border transition-all ${
                                  aspect === a.id
                                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                                    : 'border-white/5 text-neutral-400 hover:border-white/15'
                                }`}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                            Duration
                          </p>
                          <div className="relative h-1.5 rounded-full bg-white/5">
                            {(() => {
                              const pct = ((duration - 2) / 14) * 100
                              return (
                                <>
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                  <input
                                    type="range"
                                    min={2}
                                    max={16}
                                    step={1}
                                    value={duration}
                                    onChange={(e) =>
                                      setDuration(Number(e.target.value))
                                    }
                                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                  />
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(96,165,250,0.8)] pointer-events-none"
                                    style={{ left: `calc(${pct}% - 7px)` }}
                                  />
                                </>
                              )
                            })()}
                          </div>
                          <p className="text-[10px] font-mono text-blue-400">
                            {duration}s
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                            Style
                          </p>
                          <div className="relative">
                            <select
                              value={style}
                              onChange={(e) => setStyle(e.target.value)}
                              className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
                            >
                              {STYLES.map((s) => (
                                <option key={s} className="bg-neutral-900">
                                  {s}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none text-xs">
                              ▾
                            </span>
                          </div>
                          <div className="space-y-2 pt-2">
                            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                              Story structure
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {STORY_FORMATS.map((format) => {
                                const selected = storyFormats.includes(format)
                                return (
                                  <button
                                    key={format}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                      setStoryFormats((previous) =>
                                        selected
                                          ? previous.filter((item) => item !== format)
                                          : [...previous, format]
                                      )
                                    }
                                    className={`rounded-full border px-2.5 py-1.5 text-[10px] transition ${
                                      selected
                                        ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                                        : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20'
                                    }`}
                                  >
                                    {format}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                            Seed
                          </p>
                          <input
                            type="number"
                            value={seed}
                            onChange={(e) =>
                              setSeed(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="random"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1">
                  <span className="font-mono">
                    {isBusy
                      ? `● ${shots.filter((s) => s.status === 'processing').length} rendering`
                      : '⌘↵ to render · drop files to attach'}
                  </span>
                  <span className="font-mono">
                    {loadingGens
                      ? 'loading assets…'
                      : `${projectAssets.length} assets in project`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: shot list ──────────────────────── */}
          <aside className="hidden xl:flex flex-col border-l border-white/5 bg-white/[0.01] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-widest text-neutral-400">
                Shot List
              </h2>
              <span className="text-[10px] font-mono text-neutral-600">
                {shots.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {shots.length === 0 && (
                <p className="text-center text-xs text-neutral-600 py-8">
                  No shots yet
                </p>
              )}
              {shots.map((s) => {
                const isActive = s.id === activeShotId
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveShotId(s.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all relative overflow-hidden ${
                      isActive
                        ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/[0.08] to-transparent'
                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-cyan-500" />
                    )}
                    <div className="flex items-center gap-2 mb-1.5">
                      <ShotStatusDot status={s.status} />
                      <span className="text-[9px] uppercase tracking-widest text-neutral-500">
                        {s.status}
                      </span>
                      <span className="ml-auto text-[9px] font-mono text-neutral-600">
                        {safeFormatTime(s.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 line-clamp-2 leading-snug">
                      {s.prompt}
                    </p>
                    {s.status === 'processing' && (
                      <div className="mt-2 h-0.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                          style={{ width: `${s.progress ?? 0}%` }}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Library modal ─────────────────────────────── */}
      <AssetLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        assets={projectAssets}
        selectedAssets={selectedLibraryAssets}
        loading={loadingGens}
        onApply={(selectedAssets) => {
          setUploads((previous) => [
            ...previous.filter((asset) => asset.source !== 'project'),
            ...selectedAssets.map((asset) => ({
              ...asset,
              id: `lib-${asset.id}`,
              source: 'project' as const,
            })),
          ])
          setLibraryOpen(false)
          notify(`${selectedAssets.length} library asset${selectedAssets.length === 1 ? '' : 's'} selected`)
        }}
      />

      <ProjectPickerModal
        open={pickerOpen}
        onClose={() => {
          if (currentProjectId) setPickerOpen(false)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function safeFormatTime(ts: number | undefined | null): string {
  if (ts == null) return '--:--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--:--'
  return format(d, 'HH:mm')
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const examples = [
    'A drone shot flying over a coastal village at sunrise, cinematic, warm light',
    'A young woman in a red cloak walking through an enchanted forest, slow tracking shot',
    'Close-up of rain hitting a neon-lit window at night, shallow depth of field',
    'A paper boat drifting down a city street after the rain, golden hour',
    'Astronaut stepping onto a crystal planet, wide lens, volumetric light',
    'Time-lapse of a thunderstorm over a desert mesa, dramatic clouds',
  ]
  return (
    <div className="text-center py-12 space-y-6">
      <div className="relative inline-block">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-fuchsia-500 flex items-center justify-center text-2xl shadow-[0_0_40px_rgba(59,130,246,0.5)]">
          ▶
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-fuchsia-500 blur-2xl opacity-40 -z-10" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
          Direct your first scene
        </h2>
        <p className="text-sm text-neutral-400 max-w-md mx-auto mt-2">
          Describe the shot, or attach images, videos, and audio to guide the
          model. Everything saves to this project automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-w-2xl mx-auto">
        {examples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left text-xs rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-blue-500/40 hover:bg-white/[0.04] transition-all text-neutral-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function ShotStatusDot({ status }: { status: Shot['status'] }) {
  const map: Record<Shot['status'], string> = {
    idle: 'bg-neutral-600',
    queued: 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    processing:
      'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]',
    done: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    failed: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  }
  return <span className={`w-1.5 h-1.5 rounded-full ${map[status]}`} />
}

function ShotCard({
  shot,
  active,
  onFocus,
  onDelete,
  notify,
}: {
  shot: Shot
  active: boolean
  onFocus: () => void
  onDelete: () => void
  notify: (s: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (active)
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  const model =
    VIDEO_MODELS.find((m) => m.id === shot.model) ?? VIDEO_MODELS[0]

  return (
    <div
      ref={ref}
      onClick={onFocus}
      className={`rounded-2xl border transition-all ${
        active
          ? 'border-blue-500/40 bg-white/[0.03]'
          : 'border-white/5 bg-white/[0.01] hover:border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-white/5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-lg bg-gradient-to-br ${model.accent} flex items-center justify-center text-sm shrink-0`}
          >
            {model.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-neutral-200 leading-snug">
              {shot.prompt}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500 font-mono">
              <span>{model.label}</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>{shot.aspect}</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>{shot.duration}s</span>
              {shot.style && (
                <>
                  <span className="w-1 h-1 rounded-full bg-neutral-700" />
                  <span>{shot.style}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ShotStatusDot status={shot.status} />
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              className="text-neutral-500 hover:text-neutral-200 px-1.5 py-1 rounded transition-colors"
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-[#0c0e14] shadow-2xl z-20 py-1">
                  {shot.videoUrl && (
                    <>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shot.videoUrl!)
                          setMenuOpen(false)
                          notify('URL copied')
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300"
                      >
                        🔗 Copy URL
                      </button>
                      <a
                        href={shot.videoUrl}
                        download
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-neutral-300"
                      >
                        ⬇ Download
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400"
                  >
                    🗑 Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {shot.ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {shot.ingredients.map((ing) => (
              <IngredientChip key={ing.id} asset={ing} compact />
            ))}
          </div>
        )}

        {shot.status === 'processing' || shot.status === 'queued' ? (
          <div className="space-y-3">
            <div className="relative aspect-video rounded-xl bg-black/60 border border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-fuchsia-500/5 animate-pulse" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                <p className="text-xs text-neutral-400 capitalize">
                  {shot.status}…
                </p>
                <p className="text-[10px] font-mono text-neutral-600">
                  {shot.progress ?? 0}%{' '}
                  {shot.eta != null && `· ~${shot.eta}s left`}
                </p>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${Math.max(shot.progress ?? 0, 3)}%` }}
              />
            </div>
          </div>
        ) : shot.videoUrl ? (
          <VideoPlayer
            src={shot.videoUrl}
            generationId={shot.generationId}
            poster={shot.ingredients.find((i) => i.kind === 'image')?.preview}
          />
        ) : (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            ⚠ {shot.error ?? 'Something went wrong'}
          </div>
        )}
      </div>
    </div>
  )
}

function VideoPlayer({
  src,
  poster,
  generationId,
}: {
  src: string
  poster?: string
  generationId?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loop, setLoop] = useState(false)
  const [rate, setRate] = useState(1)
  const [showTools, setShowTools] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = muted
    el.loop = loop
    el.playbackRate = rate
  }, [muted, loop, rate])

  async function togglePip() {
    const el = ref.current
    if (!el) return
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture()
      } else if ((el as any).requestPictureInPicture) {
        await (el as any).requestPictureInPicture()
      }
    } catch {}
  }

  async function toggleFullscreen() {
    const el = ref.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {}
  }

  return (
    <div
      className="group relative rounded-xl overflow-hidden border border-white/10 bg-black"
      onMouseEnter={() => setShowTools(true)}
      onMouseLeave={() => setShowTools(false)}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        playsInline
        onCanPlay={() => setReady(true)}
        className="w-full max-h-[520px] bg-black"
      />

      <div
        className={`absolute top-3 left-3 right-3 flex items-start justify-between gap-2 transition-opacity ${
          showTools ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-1 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
            ● READY
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-md text-sm text-neutral-200 hover:text-white hover:bg-black/90 transition-colors"
            title="Mute"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => setLoop((l) => !l)}
            className={`w-8 h-8 rounded-lg backdrop-blur-md text-sm transition-colors ${
              loop
                ? 'bg-blue-500/80 text-white'
                : 'bg-black/70 text-neutral-200 hover:bg-black/90 hover:text-white'
            }`}
            title="Loop"
          >
            ↻
          </button>
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="h-8 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono text-neutral-200 px-2 border border-white/10 focus:outline-none cursor-pointer"
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} className="bg-neutral-900" value={r}>
                {r}×
              </option>
            ))}
          </select>
          <button
            onClick={togglePip}
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-md text-sm text-neutral-200 hover:text-white hover:bg-black/90 transition-colors"
            title="Picture in picture"
          >
            ⧉
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-md text-sm text-neutral-200 hover:text-white hover:bg-black/90 transition-colors"
            title="Fullscreen"
          >
            ⛶
          </button>
          <a
            href={src}
            download
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-md text-sm text-neutral-200 hover:text-white hover:bg-black/90 transition-colors inline-flex items-center justify-center"
            title="Download"
          >
            ⬇
          </a>
          {generationId ? (
            <Link
              href={`/editor/${generationId}`}
              className="h-8 px-2.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-semibold text-neutral-200 hover:text-white hover:bg-black/90 transition-colors inline-flex items-center"
              title="Open in editor"
            >
              ✎ Edit
            </Link>
          ) : (
            <button
              disabled
              className="h-8 px-2.5 rounded-lg bg-black/40 text-[10px] font-semibold text-neutral-500 cursor-not-allowed inline-flex items-center"
              title="Editor unavailable — generation id missing"
            >
              ✎ Edit
            </button>
          )}
        </div>
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        </div>
      )}
    </div>
  )
}

function IngredientChip({
  asset,
  onRemove,
  compact,
}: {
  asset: StudioAsset
  onRemove?: () => void
  compact?: boolean
}) {
  const icon =
    asset.kind === 'image'
      ? '▣'
      : asset.kind === 'video'
        ? '▶'
        : asset.kind === 'audio'
          ? '◉'
          : '⌘'
  const accent =
    asset.kind === 'image'
      ? 'from-fuchsia-500 to-purple-600'
      : asset.kind === 'video'
        ? 'from-emerald-500 to-teal-600'
        : asset.kind === 'audio'
          ? 'from-amber-500 to-orange-600'
          : 'from-cyan-500 to-blue-600'

  return (
    <div
      className={`group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] ${
        compact ? 'pl-1 pr-2 py-1' : 'pl-1 pr-2.5 py-1'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-[10px]`}
      >
        {icon}
      </div>
      {!compact && (
        <span className="text-[10px] text-neutral-300 max-w-[140px] truncate">
          {asset.name}
        </span>
      )}
      {compact && asset.status === 'uploading' && (
        <span className="text-[9px] font-mono text-blue-400">
          {asset.progress ?? 0}%
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-neutral-500 hover:text-red-400 text-[10px] ml-0.5"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function AssetLibraryModal({
  open,
  onClose,
  assets,
  selectedAssets,
  onApply,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  assets: StudioAsset[]
  selectedAssets: StudioAsset[]
  onApply: (assets: StudioAsset[]) => void
  loading?: boolean
}) {
  const [filter, setFilter] = useState<AssetKind | 'all'>('all')
  const [q, setQ] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSelectedIds(
        selectedAssets.map((asset) => asset.generationId ?? asset.id.replace(/^lib-/, ''))
      )
    }
  }, [open, selectedAssets])

  if (!open) return null

  const filtered = assets.filter((a) => {
    if (filter !== 'all' && a.kind !== filter) return false
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[80vh] rounded-2xl border border-white/10 bg-[#0a0c12] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">
              ◈
            </div>
            <div>
              <h3 className="text-sm font-semibold">Project Library</h3>
              <p className="text-[10px] text-neutral-500">
                Select one or more assets for this generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 text-lg w-8 h-8 rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
            {(['all', 'image', 'video', 'audio', 'text'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md transition-all ${
                  filter === k
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[160px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <span className="text-[10px] font-mono text-neutral-600">
            {filtered.length} / {assets.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
              <p className="text-xs text-neutral-500 font-mono">
                Loading library…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-blue-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center text-xl">
                ◈
              </div>
              <p className="text-xs text-neutral-500">
                {assets.length === 0
                  ? 'No assets in this project yet'
                  : 'No assets match your filter'}
              </p>
              <p className="text-[10px] text-neutral-600">
                {assets.length === 0
                  ? 'Generate or upload media, then reopen the library'
                  : 'Try a different filter or search term'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={selectedIds.includes(a.generationId ?? a.id)}
                  onClick={() =>
                    setSelectedIds((previous) => {
                      const assetId = a.generationId ?? a.id
                      return previous.includes(assetId)
                        ? previous.filter((id) => id !== assetId)
                        : [...previous, assetId]
                    })
                  }
                  className={`group relative overflow-hidden rounded-xl border bg-white/[0.02] text-left transition-all ${
                    selectedIds.includes(a.generationId ?? a.id)
                      ? 'border-cyan-400/60 ring-1 ring-cyan-400/30'
                      : 'border-white/10 hover:border-blue-500/40'
                  }`}
                >
                  {selectedIds.includes(a.generationId ?? a.id) && (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[9px] font-semibold text-black">
                      Selected
                    </span>
                  )}
                  <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                    {a.kind === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={a.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    {a.kind === 'video' && (
                      <video
                        src={a.url}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {a.kind === 'audio' && (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-transparent">
                        <span className="text-3xl">◉</span>
                      </div>
                    )}
                    {a.kind === 'text' && (
                      <div className="w-full h-full p-2 overflow-hidden">
                        <p className="text-[9px] text-neutral-400 line-clamp-4 leading-snug">
                          {a.url.slice(0, 120)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-neutral-300 truncate">
                      {a.name}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-neutral-600 mt-0.5">
                      {a.kind}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-[10px] font-mono text-neutral-500">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onApply(
                  assets.filter((asset) =>
                    selectedIds.includes(asset.generationId ?? asset.id)
                  )
                )
              }
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
            >
              Use selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Named export alias so both import styles work
// ─────────────────────────────────────────────────────────────
export { VideoMode }