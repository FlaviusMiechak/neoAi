// src/app/editor/[generationId]/_components/InspectorPanel.tsx
'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Generation } from '@/lib/generation-types'

type Tool = 'properties' | 'cast' | 'trim' | 'merge' | 'audio' | 'overlay' | 'export'

export default function InspectorPanel({
  current,
  selectedAsset,
  onUpdateCurrent,
  onRefreshAssets,
}: {
  current: Generation
  selectedAsset: Generation | null
  onUpdateCurrent: (g: Generation) => void
  onRefreshAssets: () => void
}) {
  const [tool, setTool] = useState<Tool>('properties')

  return (
    <div
      role="complementary"
      className="w-[300px] flex-shrink-0 border-l border-neutral-800 bg-[#111114] flex flex-col"
    >
      {/* Tabs */}
      <div className="flex border-b border-neutral-800 overflow-x-auto">
        {(
          [
            ['properties', '⚙'],
            ['cast', '🎭'],
            ['trim', '✂'],
            ['merge', '🧩'],
            ['audio', '🎵'],
            ['overlay', '🖼'],
            ['export', '↗'],
          ] as const
        ).map(([value, icon]) => (
          <button
            key={value}
            onClick={() => setTool(value)}
            className={`flex-1 py-2.5 text-xs transition whitespace-nowrap ${
              tool === value
                ? 'text-neutral-100 border-b-2 border-blue-500 -mb-px'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={value}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tool === 'properties' && (
          <PropertiesSection current={current} selectedAsset={selectedAsset} />
        )}
        {tool === 'cast' && (
          <CastSection current={current} onUpdateCurrent={onUpdateCurrent} />
        )}
        {tool === 'trim' && (
          <TrimSection current={current} onUpdateCurrent={onUpdateCurrent} />
        )}
        {tool === 'merge' && (
          <MergeSection current={current} onUpdateCurrent={onUpdateCurrent} />
        )}
        {tool === 'audio' && (
          <AudioSection current={current} />
        )}
        {tool === 'overlay' && (
          <OverlaySection current={current} />
        )}
        {tool === 'export' && <ExportSection current={current} />}
      </div>
    </div>
  )
}

/* ── Sections ─────────────────────────────────── */

function PropertiesSection({
  current,
  selectedAsset,
}: {
  current: Generation
  selectedAsset: Generation | null
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Properties</SectionTitle>
      <Field label="Mode" value={current.mode} />
      <Field label="Created" value={new Date(current.created_at).toLocaleString()} />
      <Field label="Prompt" value={current.prompt} multiline />
      {selectedAsset && (
        <>
          <SectionTitle>Selected asset</SectionTitle>
          <Field label="Mode" value={selectedAsset.mode} />
          <Field label="Prompt" value={selectedAsset.prompt} multiline />
        </>
      )}
    </div>
  )
}

function CastSection({
  current,
  onUpdateCurrent,
}: {
  current: Generation
  onUpdateCurrent: (g: Generation) => void
}) {
  const ethnicityOptions = ['Black African', 'Chinese', 'Japanese', 'American']
  const [profile, setProfile] = useState({
    enabled: false,
    role: 'any' as 'any' | 'actor' | 'actress',
    ethnicities: [] as string[],
    notes: '',
  })

  function applyCast() {
    const prompt = buildCharacterCastPrompt(current.prompt, profile)
    onUpdateCurrent({ ...current, prompt })
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Character cast</SectionTitle>

      <div className="rounded-xl border border-white/10 bg-[#0d0d0f] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-300">Enable cast guidance</span>
          <button
            type="button"
            onClick={() => setProfile((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`rounded-full px-2 py-1 text-[10px] font-medium ${
              profile.enabled
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                : 'bg-white/[0.03] text-neutral-300 border border-white/10'
            }`}
          >
            {profile.enabled ? 'On' : 'Off'}
          </button>
        </div>

        {profile.enabled && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(['any', 'actor', 'actress'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setProfile((prev) => ({ ...prev, role }))}
                  className={`rounded-lg border px-2 py-2 text-[10px] uppercase tracking-[0.1em] ${
                    profile.role === role
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-200'
                      : 'border-white/10 bg-white/[0.02] text-neutral-300'
                  }`}
                >
                  {role === 'any' ? 'Any' : role}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500">
                Ethnicity options
              </label>
              <div className="flex flex-wrap gap-2">
                {ethnicityOptions.map((ethnicity) => {
                  const active = profile.ethnicities.includes(ethnicity)
                  return (
                    <button
                      key={ethnicity}
                      type="button"
                      onClick={() =>
                        setProfile((prev) => ({
                          ...prev,
                          ethnicities: active
                            ? prev.ethnicities.filter((item) => item !== ethnicity)
                            : [...prev.ethnicities, ethnicity],
                        }))
                      }
                      className={`rounded-full px-2.5 py-1.5 text-[10px] ${
                        active
                          ? 'border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200'
                          : 'border border-white/10 bg-white/[0.02] text-neutral-300'
                      }`}
                    >
                      {ethnicity}
                    </button>
                  )
                })}
              </div>
            </div>

            <textarea
              value={profile.notes}
              onChange={(e) => setProfile((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="Optional style notes: calm, confident, cinematic..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 resize-none"
            />
          </>
        )}

        <button onClick={applyCast} className="btn-primary w-full">
          Apply cast direction
        </button>
      </div>
    </div>
  )
}

function buildCharacterCastPrompt(
  basePrompt: string,
  profile: { enabled?: boolean; role?: 'any' | 'actor' | 'actress'; ethnicities?: string[]; notes?: string }
) {
  if (!basePrompt || !profile.enabled) return basePrompt

  const roleText =
    profile.role === 'actor'
      ? 'male actor'
      : profile.role === 'actress'
        ? 'female actress'
        : 'character'

  const selectedEthnicities = (profile.ethnicities ?? []).filter(Boolean)
  const ethnicityText =
    selectedEthnicities.length > 0
      ? selectedEthnicities.join(', ')
      : 'any appearance that fits the scene'

  const notes = (profile.notes ?? '').trim()
  const extra = notes
    ? ` ${notes}`
    : ' Only include these traits when they naturally fit the story; they are not required.'

  return `${basePrompt}\n\nCharacter casting: ${roleText} with appearance options: ${ethnicityText}.${extra}`
}

function TrimSection({
  current,
  onUpdateCurrent,
}: {
  current: Generation
  onUpdateCurrent: (g: Generation) => void
}) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(10)
  const [busy, setBusy] = useState(false)

  async function apply() {
    setBusy(true)
    try {
      const res = await fetch('/api/video/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: current.result,
          start,
          end,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trim failed')
      onUpdateCurrent({ ...current, result: data.url })
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Trim clip</SectionTitle>
      <Field label="Start (s)" value={String(start)}>
        <input
          type="number"
          value={start}
          min={0}
          step={0.1}
          onChange={(e) => setStart(parseFloat(e.target.value))}
          className="input-dark"
        />
      </Field>
      <Field label="End (s)" value={String(end)}>
        <input
          type="number"
          value={end}
          min={0}
          step={0.1}
          onChange={(e) => setEnd(parseFloat(e.target.value))}
          className="input-dark"
        />
      </Field>
      <button onClick={apply} disabled={busy} className="btn-primary w-full">
        {busy ? 'Trimming…' : 'Apply trim'}
      </button>
    </div>
  )
}

function MergeSection({
  current,
  onUpdateCurrent,
}: {
  current: Generation
  onUpdateCurrent: (g: Generation) => void
}) {
  const [mode, setMode] = useState<'intro' | 'watermark' | 'side-by-side' | 'split'>('intro')
  const [busy, setBusy] = useState(false)

  async function apply() {
    setBusy(true)
    try {
      // uses selected image + current video
      // expects the parent to pass selection via props; for now placeholder
      setBusy(false)
    } catch (e: any) {
      alert(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Merge</SectionTitle>
      <Field label="Mode" value={mode}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className="input-dark"
        >
          <option value="intro">Intro card</option>
          <option value="watermark">Watermark</option>
          <option value="side-by-side">Side by side</option>
          <option value="split">Split screen</option>
        </select>
      </Field>
      <button onClick={apply} disabled={busy} className="btn-primary w-full">
        {busy ? 'Merging…' : 'Apply merge'}
      </button>
    </div>
  )
}

function AudioSection({ current }: { current: Generation }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Audio</SectionTitle>
      <p className="text-xs text-neutral-500">
        Audio tools coming soon — replace, mix, fade in/out.
      </p>
    </div>
  )
}

function OverlaySection({ current }: { current: Generation }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Overlay</SectionTitle>
      <p className="text-xs text-neutral-500">
        Add image, text, or logo overlays here.
      </p>
    </div>
  )
}

function ExportSection({ current }: { current: Generation }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Export</SectionTitle>
      <a
        href={current.result}
        download
        className="btn-primary w-full block text-center"
      >
        Download original
      </a>
    </div>
  )
}

/* ── Primitives ───────────────────────────────── */

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
      {children}
    </h3>
  )
}

function Field({
  label,
  value,
  multiline,
  children,
}: {
  label: string
  value: string
  multiline?: boolean
  children?: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-400">{label}</label>
      {children ?? (
        <div
          className={`text-xs bg-[#0d0d0f] border border-neutral-800 rounded-md px-2 py-1.5 ${
            multiline ? 'whitespace-pre-wrap max-h-32 overflow-y-auto' : ''
          }`}
        >
          {value}
        </div>
      )}
    </div>
  )
}