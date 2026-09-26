// lib/generation-types.ts
export type GenerationMode = 'text' | 'image' | 'audio' | 'video' | 'chat'

export interface Generation {
  id: string
  project_id: string
  mode: GenerationMode
  prompt: string
  result: string
  metadata: string | null
  created_at: string
}

export interface EnrichedGeneration extends Generation {
  metadataObj: Record<string, any> | null
}

export function withParsedMetadata(g: Generation): EnrichedGeneration {
  let metadataObj: Record<string, any> | null = null
  if (g.metadata) {
    try {
      metadataObj = JSON.parse(g.metadata)
    } catch {
      metadataObj = null
    }
  }
  return { ...g, metadataObj }
}

// ── Audio-specific ────────────────────────────────────────────
export type AudioSubMode =
  | 'tts'
  | 'music'
  | 'sfx'
  | 'voice-clone'
  | 'podcast'
  | 'ambient'

export interface AudioGenerationMetadata {
  provider: string
  submode: AudioSubMode
  voice?: string
  language?: string
  speed?: number
  pitch?: number
  stability?: number
  duration?: number
  style?: string
  loop?: boolean
  hasReference?: boolean
  model?: string
}

export function getAudioMetadata(
  g: EnrichedGeneration
): AudioGenerationMetadata | null {
  if (g.mode !== 'audio' || !g.metadataObj) return null
  return g.metadataObj as AudioGenerationMetadata
}