// src/app/editor/[generationId]/EditorWorkspace.tsx
'use client'

import { useMemo, useState } from 'react'
import TopBar from './_components/TopBar'
import LeftPanel from './_components/LeftPanel'
import PreviewStage from './_components/PreviewStage'
import InspectorPanel from './_components/InspectorPanel'
import Timeline from './_components/Timeline'
import StatusBar from './_components/StatusBar'
import SaveAsNewDialog from './_components/SaveAsNewDialog'
import type { Generation } from '@/lib/generation-types'

export default function EditorWorkspace({
  initialGeneration,
  initialAssets,
  initialTimeline,
}: {
  initialGeneration: Generation
  initialAssets: Generation[]
  initialTimeline: any
}) {
  const [current, setCurrent] = useState<Generation>(initialGeneration)
  const [assets, setAssets] = useState<Generation[]>(initialAssets)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [saveOpen, setSaveOpen] = useState(false)

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  )

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0f] text-neutral-100 overflow-hidden">
      <TopBar
        generation={current}
        onSave={() => setSaveOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left: asset library + tools */}
        <LeftPanel
          assets={assets}
          selectedId={selectedAssetId}
          onSelect={setSelectedAssetId}
          current={current}
          onSwapCurrent={setCurrent}
        />

        {/* Center: preview + timeline stack */}
        <div className="flex-1 flex flex-col min-w-0">
          <PreviewStage
            generation={current}
            playing={playing}
            playhead={playhead}
            onPlayhead={setPlayhead}
            onDuration={setDuration}
            onPlaying={setPlaying}
          />
          <Timeline
            generation={current}
            assets={assets}
            duration={duration}
            playhead={playhead}
            onPlayhead={setPlayhead}
            zoom={zoom}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        </div>

        {/* Right: inspector + tools */}
        <InspectorPanel
          current={current}
          selectedAsset={selectedAsset}
          onUpdateCurrent={setCurrent}
          onRefreshAssets={() => {
            /* re-fetch list */
          }}
        />
      </div>

      <StatusBar
        duration={duration}
        playhead={playhead}
        zoom={zoom}
        onZoom={setZoom}
        resolution={`${current.metadata ? '' : ''}`}
      />

      <SaveAsNewDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        parentGeneration={current}
        onSaved={(newGen) => {
          setAssets((prev) => [newGen, ...prev])
          setSaveOpen(false)
        }}
      />
    </div>
  )
}