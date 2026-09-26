// src/app/project/[projectId]/AudioMode.tsx
'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { format } from 'date-fns'
import { useCurrentProject } from '@/lib/useCurrentProject'
import {
  type Generation,
  type EnrichedGeneration,
  type AudioSubMode,
  withParsedMetadata,
  getAudioMetadata,
} from '@/lib/generation-types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type GenerationState = 'idle' | 'queued' | 'generating' | 'done' | 'error'

interface AudioAsset {
  id: string
  url: string
  name: string
  prompt: string
  action: AudioSubMode
  createdAt: number
  voice?: string
}

interface AdvancedControlsProps {
  action: AudioSubMode
  voice: string
  setVoice: (v: string) => void
  language: string
  setLanguage: (v: string) => void
  speed: number
  setSpeed: (v: number) => void
  pitch: number
  setPitch: (v: number) => void
  stability: number
  setStability: (v: number) => void
  duration: number
  setDuration: (v: number) => void
  style: 'neutral' | 'cinematic' | 'lofi' | 'energetic'
  setStyle: (v: AdvancedControlsProps['style']) => void
  loop: boolean
  setLoop: (v: boolean) => void
  referenceFile: File | null
  setReferenceFile: (f: File | null) => void
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ACTION_META: Record<
  AudioSubMode,
  { label: string; icon: string; hint: string; accent: string; placeholder: string }
> = {
  tts: {
    label: 'Text to Speech',
    icon: '⌨',
    hint: 'Natural neural voices',
    accent: 'from-cyan-500 to-blue-600',
    placeholder: 'Type or paste the text you want spoken…',
  },
  music: {
    label: 'Music',
    icon: '♪',
    hint: 'Full tracks & loops',
    accent: 'from-fuchsia-500 to-purple-600',
    placeholder: 'e.g. cinematic orchestral swell with rising strings…',
  },
  sfx: {
    label: 'Sound FX',
    icon: '⚡',
    hint: 'Foley & one-shots',
    accent: 'from-amber-500 to-orange-600',
    placeholder: 'e.g. heavy metal door slamming in a cavern…',
  },
  'voice-clone': {
    label: 'Voice Clone',
    icon: '◉',
    hint: 'Match a reference voice',
    accent: 'from-emerald-500 to-teal-600',
    placeholder: 'Paste text to speak in the cloned voice…',
  },
  podcast: {
    label: 'Podcast',
    icon: '🎙',
    hint: 'Multi-speaker dialogue',
    accent: 'from-rose-500 to-pink-600',
    placeholder: 'e.g. Host A: Welcome back… Host B: Thanks for having me…',
  },
  ambient: {
    label: 'Ambient',
    icon: '◌',
    hint: 'Textures & atmospheres',
    accent: 'from-indigo-500 to-violet-600',
    placeholder: 'e.g. distant rain on a tin roof, soft thunder…',
  },
}

const VOICES = [
  { id: 'aria', label: 'Aria', tag: 'Warm · Female' },
  { id: 'atlas', label: 'Atlas', tag: 'Deep · Male' },
  { id: 'nova', label: 'Nova', tag: 'Bright · Neutral' },
  { id: 'orion', label: 'Orion', tag: 'Gritty · Male' },
  { id: 'luna', label: 'Luna', tag: 'Soft · Female' },
  { id: 'echo', label: 'Echo', tag: 'Robotic · FX' },
]

const LANGUAGES = [
  'English (US)', 'English (UK)', 'Spanish', 'French', 'German',
  'Italian', 'Portuguese', 'Japanese', 'Korean', 'Mandarin',
  'Hindi', 'Arabic', 'Russian',
]

// Stable client-side id fallback
function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function AudioMode() {
  const { project } = useCurrentProject()
  const projectId = project?.id

  const [action, setAction] = useState<AudioSubMode>('tts')
  const [prompt, setPrompt] = useState('')
  const [voice, setVoice] = useState('aria')
  const [language, setLanguage] = useState('English (US)')
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [stability, setStability] = useState(0.75)
  const [duration, setDuration] = useState(30)
  const [style, setStyle] = useState<'neutral' | 'cinematic' | 'lofi' | 'energetic'>(
    'neutral'
  )
  const [loop, setLoop] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)

  const [state, setState] = useState<GenerationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<AudioAsset[]>([])
  const [activeAsset, setActiveAsset] = useState<AudioAsset | null>(null)
  const [history, setHistory] = useState<string[]>([])

  // ── Hydrate from project.generations ─────────────────────
  useEffect(() => {
    if (!project?.generations) return
    const restored: AudioAsset[] = (project.generations as unknown as Generation[])
      .map((g) => withParsedMetadata(g) as EnrichedGeneration)
      .filter((g) => g.mode === 'audio')
      .map((g) => {
        const meta = getAudioMetadata(g)
        const submode: AudioSubMode = meta?.submode ?? 'tts'
        return {
          id: g.id,
          url: g.result,
          name: `${ACTION_META[submode].label} · ${format(
            new Date(g.created_at),
            'HH:mm:ss'
          )}`,
          prompt: g.prompt,
          action: submode,
          createdAt: new Date(g.created_at).getTime(),
          voice: meta?.voice,
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)

    setAssets(restored)
    if (restored[0]) setActiveAsset(restored[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.generations?.length])

  // ── Generate ─────────────────────────────────────────────
  const run = useCallback(async () => {
    if (!projectId) {
      setError('Open this page from a project to generate audio.')
      setState('error')
      return
    }
    if (action === 'voice-clone' && !referenceFile) {
      setError('Upload a reference clip for voice cloning.')
      setState('error')
      return
    }
    if (!prompt.trim()) {
      setError('Enter a prompt first.')
      setState('error')
      return
    }

    setState('queued')
    setError(null)
    setHistory((h) => [prompt, ...h].slice(0, 10))

    await new Promise((r) => setTimeout(r, 200))
    setState('generating')

    try {
      const common = {
        action: 'audio',
        mode: action,
        prompt,
        projectId,
        voice,
        language,
        speed: String(speed),
        pitch: String(pitch),
        stability: String(stability),
        duration: String(duration),
        style,
        loop: String(loop),
      }

      let res: Response
      if (referenceFile) {
        const fd = new FormData()
        Object.entries(common).forEach(([k, v]) => fd.append(k, v))
        fd.append('reference', referenceFile)
        res = await fetch('/api/generate', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(common),
        })
      }

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : JSON.stringify(data.error)
        )
      }

      const url: string = data.url || data.audio_url
      if (!url) throw new Error('No audio URL returned')

      const asset: AudioAsset = {
        id: uid(),
        url,
        name: `${ACTION_META[action].label} · ${format(
          Date.now(),
          'HH:mm:ss'
        )}`,
        prompt,
        action,
        createdAt: Date.now(),
        voice: data.voice,
      }

      setAssets((a) => [asset, ...a])
      setActiveAsset(asset)
      setState('done')
      // Persistence is handled server-side inside /api/generate.
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed')
      setState('error')
    }
  }, [
    prompt, action, voice, language, speed, pitch, stability,
    duration, style, loop, referenceFile, projectId,
  ])

  const meta = ACTION_META[action]

  return (
    <div className="relative">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-fuchsia-500 flex items-center justify-center text-lg font-bold shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                ⌬
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 blur-lg opacity-40 -z-10" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                Audio Studio
              </h1>
              <p className="text-xs text-neutral-500">
                Neural synthesis · realtime DSP · project:{' '}
                <span className="text-neutral-300 font-mono">
                  {project?.name ?? 'untitled'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill state={state} />
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] font-mono text-[10px] text-neutral-500">
              <span>SR 48kHz</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>24-bit</span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span>STEREO</span>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          {/* LEFT */}
          <div className="space-y-5 min-w-0">
            {/* Mode tabs */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {(Object.keys(ACTION_META) as AudioSubMode[]).map((a) => {
                const m = ACTION_META[a]
                const active = action === a
                return (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`group relative flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200 overflow-hidden ${
                      active
                        ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-transparent'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${m.accent} flex items-center justify-center text-sm ${
                        active ? 'shadow-lg' : 'opacity-70 group-hover:opacity-100'
                      } transition-opacity`}
                    >
                      {m.icon}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400 text-center leading-tight">
                      {m.label}
                    </span>
                    {active && (
                      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Prompt card */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    Prompt
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    {prompt.length} / 2000
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    ✦ Enhance
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={meta.placeholder}
                rows={6}
                maxLength={2000}
                className="w-full bg-transparent px-5 py-4 text-sm placeholder:text-neutral-600 focus:outline-none resize-none leading-relaxed"
              />

              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {['Whisper', 'Echo', 'Reverb', '8-bit', 'Lo-fi'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setPrompt((p) => (p ? `${p}, ${tag.toLowerCase()}` : tag))
                      }
                      className="text-[10px] px-2 py-1 rounded-full border border-white/5 bg-white/[0.02] text-neutral-400 hover:border-blue-500/40 hover:text-blue-300 transition-all"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-neutral-600 font-mono">
                  ⌘ + ↵
                </span>
              </div>
            </div>

            <AdvancedControls
              action={action}
              voice={voice}
              setVoice={setVoice}
              language={language}
              setLanguage={setLanguage}
              speed={speed}
              setSpeed={setSpeed}
              pitch={pitch}
              setPitch={setPitch}
              stability={stability}
              setStability={setStability}
              duration={duration}
              setDuration={setDuration}
              style={style}
              setStyle={setStyle}
              loop={loop}
              setLoop={setLoop}
              referenceFile={referenceFile}
              setReferenceFile={setReferenceFile}
            />

            <button
              onClick={run}
              disabled={state === 'generating' || state === 'queued' || !projectId}
              className="group relative w-full py-3.5 rounded-xl text-sm font-semibold overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-fuchsia-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
              <span className="relative flex items-center justify-center gap-2">
                {state === 'generating' || state === 'queued' ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {state === 'queued' ? 'Queued…' : 'Synthesizing…'}
                  </>
                ) : (
                  <>
                    <span>◉</span>
                    Generate Audio
                    <span className="text-[10px] font-mono opacity-70">
                      −12 credits
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

            {activeAsset && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400">
                      Now Playing
                    </span>
                    <span className="text-xs text-neutral-400 truncate">
                      {activeAsset.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadAudio(activeAsset)}
                      className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-blue-300 transition-colors"
                    >
                      ⬇ WAV
                    </button>
                    <button
                      onClick={() => {
                        setAssets((a) =>
                          a.filter((x) => x.id !== activeAsset.id)
                        )
                        setActiveAsset(null)
                      }}
                      className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <WaveformPlayer src={activeAsset.url} accent={meta.accent} />
              </div>
            )}

            {activeAsset && <PostProcessing src={activeAsset.url} />}
          </div>

          {/* RIGHT */}
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-neutral-400">
                  Library
                </h3>
                <span className="text-[10px] font-mono text-neutral-600">
                  {assets.length}
                </span>
              </div>

              <div className="max-h-[420px] overflow-y-auto p-2 space-y-1.5">
                {assets.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-neutral-600">No clips yet</p>
                    <p className="text-[10px] text-neutral-700 mt-1">
                      Generate to populate
                    </p>
                  </div>
                )}
                {assets.map((asset) => {
                  const m = ACTION_META[asset.action]
                  const active = activeAsset?.id === asset.id
                  return (
                    <button
                      key={asset.id}
                      onClick={() => setActiveAsset(asset)}
                      className={`group w-full text-left p-2.5 rounded-lg border transition-all relative overflow-hidden ${
                        active
                          ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/[0.08] to-transparent'
                          : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                      }`}
                    >
                      {active && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-cyan-500" />
                      )}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-md bg-gradient-to-br ${m.accent} flex items-center justify-center text-xs shrink-0`}
                        >
                          {m.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-neutral-200 truncate">
                            {asset.prompt || m.label}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] uppercase tracking-widest text-neutral-500">
                              {m.label}
                            </span>
                            <span className="text-[9px] text-neutral-600 font-mono">
                              {format(asset.createdAt, 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {history.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest text-neutral-400">
                    Recent Prompts
                  </h3>
                </div>
                <div className="p-2 space-y-1">
                  {history.slice(0, 5).map((h, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(h)}
                      className="w-full text-left text-xs text-neutral-400 hover:text-neutral-100 px-2.5 py-2 rounded-md hover:bg-white/[0.03] transition-colors line-clamp-2"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-[10px] uppercase tracking-widest text-neutral-400">
                Signal Chain
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Encoder', on: true },
                  { label: 'Vocoder', on: true },
                  { label: 'Post-EQ', on: activeAsset != null },
                  { label: 'Limiter', on: activeAsset != null },
                ].map((node) => (
                  <div
                    key={node.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-neutral-400">{node.label}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        node.on
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'bg-neutral-700'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatusPill({ state }: { state: GenerationState }) {
  const map: Record<GenerationState, { c: string; t: string }> = {
    idle: { c: 'text-neutral-400 border-white/10 bg-white/5', t: 'IDLE' },
    queued: { c: 'text-amber-400 border-amber-500/30 bg-amber-500/10', t: 'QUEUED' },
    generating: { c: 'text-blue-400 border-blue-500/30 bg-blue-500/10', t: 'RUNNING' },
    done: { c: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', t: 'READY' },
    error: { c: 'text-red-400 border-red-500/30 bg-red-500/10', t: 'ERROR' },
  }
  const s = map[state]
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase tracking-widest ${s.c}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          state === 'generating' ? 'animate-pulse bg-current' : 'bg-current'
        }`}
      />
      {s.t}
    </div>
  )
}

function AdvancedControls({
  action,
  voice, setVoice,
  language, setLanguage,
  speed, setSpeed,
  pitch, setPitch,
  stability, setStability,
  duration, setDuration,
  style, setStyle,
  loop, setLoop,
  referenceFile, setReferenceFile,
}: AdvancedControlsProps) {
  const showVoice =
    action === 'tts' || action === 'voice-clone' || action === 'podcast'
  const showDuration =
    action === 'music' ||
    action === 'sfx' ||
    action === 'ambient' ||
    action === 'podcast'
  const showStyle = action === 'music' || action === 'ambient'

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-neutral-500">
          Parameters
        </h3>
        <button
          type="button"
          className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {showVoice && (
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Voice
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(v.id)}
                  className={`text-left p-2.5 rounded-lg border transition-all ${
                    voice === v.id
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  <p className="text-xs font-medium text-neutral-200">{v.label}</p>
                  <p className="text-[9px] text-neutral-500 mt-0.5">{v.tag}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {action === 'voice-clone' && (
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Reference Clip
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 hover:border-blue-500/40 cursor-pointer transition-colors bg-white/[0.01]">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm shrink-0">
                ⬆
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-200 truncate">
                  {referenceFile ? referenceFile.name : 'Drop or click to upload'}
                </p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  WAV · MP3 · 10s–60s recommended
                </p>
              </div>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        {showVoice && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} className="bg-neutral-900">
                    {l}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none text-xs">
                ▾
              </span>
            </div>
          </div>
        )}

        {showDuration && (
          <Slider
            label="Duration"
            value={duration}
            display={`${duration}s`}
            min={5}
            max={300}
            step={5}
            onChange={setDuration}
          />
        )}

        {(action === 'tts' || action === 'podcast' || action === 'voice-clone') && (
          <>
            <Slider
              label="Speed"
              value={speed}
              display={`${speed.toFixed(2)}×`}
              min={0.5}
              max={2}
              step={0.05}
              onChange={setSpeed}
            />
            <Slider
              label="Pitch"
              value={pitch}
              display={`${pitch > 0 ? '+' : ''}${pitch} st`}
              min={-12}
              max={12}
              step={1}
              onChange={setPitch}
            />
            <Slider
              label="Stability"
              value={stability}
              display={`${Math.round(stability * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              onChange={setStability}
            />
          </>
        )}

        {showStyle && (
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500">
              Style
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['neutral', 'cinematic', 'lofi', 'energetic'] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`text-xs capitalize py-2 rounded-lg border transition-all ${
                      style === s
                        ? 'border-blue-500/50 bg-blue-500/10 text-white'
                        : 'border-white/5 text-neutral-400 hover:border-white/15'
                    }`}
                  >
                    {s}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
          <div>
            <p className="text-xs text-neutral-200">Loop seamlessly</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Crossfade edges for infinite playback
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoop(!loop)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              loop ? 'bg-blue-500' : 'bg-white/10'
            }`}
            aria-pressed={loop}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                loop ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

function WaveformPlayer({ src, accent }: { src: string; accent: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)

  const bars = useMemo(() => {
    let seed = 0
    for (let i = 0; i < src.length; i++)
      seed = (seed * 31 + src.charCodeAt(i)) % 100000
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    return Array.from({ length: 96 }, () => 0.15 + rand() * 0.85)
  }, [src])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = muted ? 0 : volume
    el.playbackRate = rate
  }, [volume, muted, rate])

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !el.duration) return
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

  const activeBars = Math.round((progress / 100) * bars.length)

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          const el = audioRef.current
          if (!el) return
          setCurrent(el.currentTime)
          setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0)
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
      />

      <div
        onClick={seek}
        className="relative h-20 rounded-xl bg-black/40 border border-white/5 overflow-hidden cursor-pointer group"
      >
        <div className="absolute inset-0 flex items-center justify-between px-2 gap-[2px]">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-100"
              style={{
                height: `${h * 100}%`,
                background:
                  i < activeBars
                    ? `linear-gradient(to top, rgb(59 130 246), rgb(34 211 238))`
                    : 'rgba(255,255,255,0.08)',
                boxShadow:
                  i < activeBars ? '0 0 6px rgba(34,211,238,0.4)' : 'none',
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none"
          style={{ left: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className={`w-11 h-11 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg hover:scale-105 transition-transform shrink-0`}
        >
          <span className="text-base">{playing ? '❚❚' : '▶'}</span>
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono text-neutral-500 w-10 text-right">
            {fmt(current)}
          </span>
          <div className="flex-1 h-1 rounded-full bg-white/5 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-neutral-500 w-10">
            {fmt(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors text-sm"
          >
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value))
              setMuted(false)
            }}
            className="w-16 accent-blue-500"
          />

          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="bg-white/[0.03] border border-white/10 rounded-md text-[10px] font-mono px-1.5 py-1 focus:outline-none cursor-pointer"
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} className="bg-neutral-900" value={r}>
                {r}×
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function PostProcessing({ src }: { src: string }) {
  const [preset, setPreset] = useState<
    'none' | 'vocal' | 'podcast' | 'master' | 'lofi'
  >('none')
  const [gain, setGain] = useState(0)
  const [lowCut, setLowCut] = useState(false)
  const [compressor, setCompressor] = useState(false)
  const [reverb, setReverb] = useState(0)

  // NOTE: these are UI-only for now. To make them actually affect playback,
  // route the <audio> element through a Web Audio graph (BiquadFilterNode,
  // DynamicsCompressorNode, ConvolverNode, GainNode).

  const PRESETS = [
    { id: 'none', label: 'Bypass' },
    { id: 'vocal', label: 'Vocal' },
    { id: 'podcast', label: 'Podcast' },
    { id: 'master', label: 'Master' },
    { id: 'lofi', label: 'Lo-fi' },
  ] as const

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">
            ⚙
          </div>
          <div>
            <h3 className="text-xs font-semibold text-neutral-200">
              Post-Processing
            </h3>
            <p className="text-[10px] text-neutral-500">Realtime DSP chain</p>
          </div>
        </div>
        <button className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300">
          Bypass All
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
              preset === p.id
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                : 'border-white/5 text-neutral-500 hover:border-white/15 hover:text-neutral-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Slider
          label="Gain"
          value={gain}
          display={`${gain > 0 ? '+' : ''}${gain} dB`}
          min={-12}
          max={12}
          step={0.5}
          onChange={setGain}
        />
        <Slider
          label="Reverb"
          value={reverb}
          display={`${Math.round(reverb * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          onChange={setReverb}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Toggle label="Low Cut (80Hz)" value={lowCut} onChange={setLowCut} />
        <Toggle label="Compressor" value={compressor} onChange={setCompressor} />
      </div>
    </div>
  )
}

function Slider({
  label, value, display, min, max, step, onChange,
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

function Toggle({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
        value
          ? 'border-blue-500/50 bg-blue-500/5'
          : 'border-white/5 bg-white/[0.01] hover:border-white/15'
      }`}
    >
      <span className="text-xs text-neutral-300">{label}</span>
      <span
        className={`relative w-9 h-5 rounded-full transition-colors ${
          value ? 'bg-blue-500' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function downloadAudio(asset: AudioAsset) {
  const a = document.createElement('a')
  a.href = asset.url
  a.download = `${asset.name.replace(/\s+/g, '_')}.mp3`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}