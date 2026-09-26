// lib/projects.ts
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Generation {
  id: string
  user_id: string
  project_id: string
  mode: string
  prompt: string
  result: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ProjectWithGenerations extends Project {
  generations: Generation[]
}

export interface ProjectWithCount extends Project {
  generation_count: number
}

// ─────────────────────────────────────────────────────────────
// Get a single project owned by a specific user
// ─────────────────────────────────────────────────────────────
export async function getProjectWithGenerations(
  userId: string,
  projectId: string
): Promise<ProjectWithGenerations | null> {
  const project = await getProject(userId, projectId)
  if (!project) return null

  const { data: generations, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return { ...project, generations: [] } as ProjectWithGenerations
  }

  return {
    ...project,
    generations: (generations ?? []) as Generation[],
  } as ProjectWithGenerations
}
export async function getProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .limit(1)

  if (error || !data?.[0]) return null
  return data[0] as Project
}

// ─────────────────────────────────────────────────────────────
// List all projects for a user (newest first)
// ─────────────────────────────────────────────────────────────

export async function getUserProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return data as Project[]
}
//generation

export async function addGeneration(params: {
  userId: string
  projectId: string
  mode: string
  prompt: string
  result: string
  metadata?: Record<string, unknown> | null
}): Promise<Generation> {
  // verify ownership first
  const { data: owned } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', params.projectId)
    .eq('user_id', params.userId)
    .limit(1)

  if (!owned?.[0]) throw new Error('Project not found or not owned by user')

  // then insert
  const { data, error } = await supabaseAdmin
    .from('generations')
    .insert({
      id: crypto.randomUUID(),
      user_id: params.userId,
      project_id: params.projectId,
      mode: params.mode,
      prompt: params.prompt,
      result: params.result,
      metadata: params.metadata ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to add generation')
  }

  return data as Generation
}

// ─────────────────────────────────────────────────────────────
// Create a new project
// ─────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  name: string,
  description?: string
): Promise<Project> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      id,
      user_id: userId,
      name,
      description: description ?? '',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create project')
  }
  return data as Project
}

// ─────────────────────────────────────────────────────────────
// Update a project (scoped to owner)
// ─────────────────────────────────────────────────────────────

export async function updateProject(
  userId: string,
  projectId: string,
  updates: { name?: string; description?: string }
): Promise<Project | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) return null
  return data as Project
}

// ─────────────────────────────────────────────────────────────
// Delete a project (scoped to owner)
// ─────────────────────────────────────────────────────────────

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  return !error
}