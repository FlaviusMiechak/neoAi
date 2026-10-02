export type GenerationMode = 'text' | 'image' | 'audio' | 'video' | 'chat';

export interface Generation {
  id: string;
  user_id: string;
  project_id: string;
  mode: GenerationMode;
  prompt: string;
  result: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}