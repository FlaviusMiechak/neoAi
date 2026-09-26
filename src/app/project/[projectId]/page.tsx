// src/app/project/[projectId]/page.tsx
import { notFound } from 'next/navigation'
import { getUserIdFromRequest } from '@/lib/auth'
import { getProjectWithGenerations } from '@/lib/projects'
import ProjectWorkspace from './ProjectWorkspace'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const userId = await getUserIdFromRequest()
  if (!userId) notFound()

  const project = await getProjectWithGenerations(userId, projectId)
  if (!project) notFound()

  return <ProjectWorkspace project={project} />
}