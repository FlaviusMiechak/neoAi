// src/app/generate/[mode]/page.tsx
import { notFound } from 'next/navigation'
import { RequireProject } from '@/components/RequireProject'
import TextMode from './_components/TextMode'
import ImageMode from './_components/ImageMode'
import AudioMode from './_components/AudioMode'
import  VideoMode from './_components/VideoMode'
import ChatMode from './_components/ChatMode'

const MODES = {
  text: TextMode,
  image: ImageMode,
  audio: AudioMode,
  video: VideoMode,
  chat: ChatMode,
} as const

type ModeKey = keyof typeof MODES

export default async function ModePage({
  params,
}: {
  params: Promise<{ mode: string }>
}) {
  const { mode } = await params

  if (!(mode in MODES)) notFound()

  const ModeComponent = MODES[mode as ModeKey]

  return (
    <RequireProject>
      <ModeComponent />
    </RequireProject>
  )
}