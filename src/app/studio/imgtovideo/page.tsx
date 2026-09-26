// src/app/studio/image-to-video/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useCurrentProject } from '@/lib/useCurrentProject'

interface Generation {
  id: string
  project_id: string
  mode: string
  prompt: string
  result: string
  created_at: string
}

export default function ImageToVideoPage() {
  const { currentProjectId } = useCurrentProject()
  const [images, setImages] = useState<Generation[]>([])
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [videoUrl, setVideoUrl] = useState<string>('')

  // Load existing image generations for this project
  useEffect(() => {
    if (!currentProjectId) return
    fetch(`/api/projects/${currentProjectId}`)
      .then((r) => r.json())
      .then((project) => {
        const imageGens = (project.generations ?? []).filter(
          (g: Generation) => g.mode === 'image'
        )
        setImages(imageGens)
        if (imageGens.length > 0) setSelectedImage(imageGens[0].result)
      })
      .catch(() => {})
  }, [currentProjectId])

  async function generate() {
    if (!currentProjectId || !selectedImage || !prompt.trim()) return
    setLoading(true)
    setStatus('Creating task...')
    setVideoUrl('')

    try {
      // 1. Create the image-to-video task
      const createRes = await fetch('/api/generate/imgtovideo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          projectId: currentProjectId,
          prompt: prompt.trim(),
          image: selectedImage,
          mode: 'ti2vid',
          height: 1280,
          width: 720,
          num_frames: 441,
          frame_rate: 24,
        }),
      })

      const created = await createRes.json()
      if (!createRes.ok) {
        throw new Error(
          typeof created?.error === 'string'
            ? created.error
            : created?.error?.message || 'Create failed'
        )
      }

      const videoId = created.videoId
      if (!videoId) throw new Error('No videoId returned from AI service')

      setStatus(`Task created: ${videoId}. Generating...`)

      // 2. Poll for completion
      while (true) {
        await new Promise((r) => setTimeout(r, 5000))
        const statusRes = await fetch('/api/generate/imgtovideo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'status',
            projectId: currentProjectId,
            videoId,
            prompt: prompt.trim(),
          }),
        })

        const data = await statusRes.json()

        if (data.status === 'completed' && data.url) {
          setVideoUrl(data.url)
          setStatus('Completed!')
          break
        }
        if (data.status === 'failed') {
          throw new Error(data.error || 'Generation failed')
        }
        setStatus(`Processing... ${data.progress ?? 0}%`)
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!currentProjectId) {
    return <p className="p-8 text-neutral-400">Select a project first.</p>
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Image to Video</h1>

        {/* Image picker */}
        <div>
          <label className="text-sm text-neutral-400 block mb-2">
            Reference image
          </label>
          {images.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No images in this project. Generate one first.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.result)}
                  className={`flex-shrink-0 rounded-lg border-2 transition ${
                    selectedImage === img.result
                      ? 'border-blue-500'
                      : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.result}
                    alt={img.prompt}
                    className="w-32 h-32 object-cover rounded"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Motion prompt */}
        <div>
          <label className="text-sm text-neutral-400 block mb-2">
            Describe the motion
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="The character slowly turns and looks at the camera, natural facial expression..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-sm"
            rows={3}
          />
        </div>

        {/* Generate */}
        <button
          onClick={generate}
          disabled={loading || !selectedImage || !prompt.trim()}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg font-medium"
        >
          {loading ? 'Generating...' : 'Generate Video'}
        </button>

        {/* Status */}
        {status && (
          <p className="text-sm text-neutral-400">{status}</p>
        )}

        {/* Result */}
        {videoUrl && (
          <div className="space-y-2">
            <video src={videoUrl} controls className="w-full rounded-lg bg-black" />
            <a
              href={videoUrl}
              download
              className="text-xs text-blue-400 hover:underline"
            >
              Download video
            </a>
          </div>
        )}
      </div>
    </main>
  )
}