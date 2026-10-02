// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createProject, getUserProjects } from '@/lib/projects'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api/projects
// Returns every project owned by the current user.
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projects = await getUserProjects(userId)
  return NextResponse.json(projects)
}

// ─────────────────────────────────────────────────────────────
// POST /api/projects
// Creates a new project for the current user.
// Body: { name: string, description?: string }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const name = body?.name?.trim()
  const description = body?.description?.trim() ?? ''

  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  try {
    const project = await createProject(userId, name, description || undefined)
    return NextResponse.json(project, { status: 201 })
  } catch (err: any) {
    console.error('[projects] createProject failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create project' },
      { status: 500 }
    )
  }
}