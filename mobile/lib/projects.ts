import { apiRequest } from '@/lib/api';
import type { Project } from '@/types/project';

export function getProjects(accessToken: string) {
  return apiRequest<Project[]>('/api/projects', accessToken);
}

export function createProject(
  accessToken: string,
  input: { name: string; description?: string },
) {
  return apiRequest<Project>('/api/projects', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}