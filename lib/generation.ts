// lib/generations.ts
import { supabaseAdmin } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type GenerationMode = 'text' | 'image' | 'audio' | 'video' | 'chat'

export interface Generation {
  id: string
  project_id: string
  mode: GenerationMode
  prompt: string
  result: string
  metadata: string | null       // stored as text in Postgres
  created_at: string
}

export interface EnrichedGeneration extends Generation {
  metadataObj: Record<string, any> | null
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Add a generation
// Signature matches the way your route calls it:
//   addGeneration(userId, projectId, { mode, prompt, result, metadata })
// ─────────────────────────────────────────────────────────────

export async function addGeneration(
  userId: string,
  projectId: string,
  data: {
    mode: GenerationMode
    prompt: string
    result: string
    metadata?: Record<string, unknown> | null
  }
): Promise<Generation> {
  // 1) Ownership check — prevents injecting into someone else's project
  const { data: owned } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .limit(1)

  if (!owned?.[0]) {
    throw new Error('Project not found or not owned by user')
  }

  // 2) Insert
  const { data: inserted, error } = await supabaseAdmin
    .from('generations')
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      mode: data.mode,
      prompt: data.prompt,
      result: data.result,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Failed to add generation')
  }

  return inserted as Generation
}

// ─────────────────────────────────────────────────────────────
// List generations for a project (newest first)
// ─────────────────────────────────────────────────────────────

export async function getProjectGenerations(
  projectId: string
): Promise<Generation[]> {
  const { data, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as Generation[]
}

// ─────────────────────────────────────────────────────────────
// Same, but scoped by owner — useful when userId is known
// ─────────────────────────────────────────────────────────────

export async function getUserProjectGenerations(
  userId: string,
  projectId: string
): Promise<Generation[]> {
  const { data: owned } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .limit(1)

  if (!owned?.[0]) return []

  return getProjectGenerations(projectId)
}

// ─────────────────────────────────────────────────────────────
// Get a single generation
// ─────────────────────────────────────────────────────────────

export async function getGeneration(
  generationId: string
): Promise<Generation | null> {
  const { data, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', generationId)
    .limit(1)

  if (error || !data?.[0]) return null
  return data[0] as Generation
}

// ─────────────────────────────────────────────────────────────
// Check whether a video generation was already saved
// (used by the /api/generate status branch to avoid duplicates)
// ─────────────────────────────────────────────────────────────

export async function generationExistsByVideoId(
  projectId: string,
  videoId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('generations')
    .select('id, metadata')
    .eq('project_id', projectId)
    .eq('mode', 'video')

  if (!data) return false

  return data.some((row) => {
    if (!row.metadata) return false
    try {
      return JSON.parse(row.metadata).videoId === videoId
    } catch {
      return false
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Delete a generation
// ─────────────────────────────────────────────────────────────

export async function deleteGeneration(
  generationId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('generations')
    .delete()
    .eq('id', generationId)

  return !error
}
export async function getGenerationById(id: string): Promise<Generation | null> {
  const { data, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getGenerationById]', error.message)
    return null
  }
  return data as Generation
}