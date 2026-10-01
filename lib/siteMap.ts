// lib/siteMap.ts

export type SiteRoute = {
  path: string
  name: string
  description: string
  tourTarget?: string   // matches a [data-tour="..."] selector
}

export type SiteFeature = {
  id: string
  name: string
  description: string
  tourTarget?: string
  route?: string
}

export const SITE_ROUTES: SiteRoute[] = [
  {
    path: '/',
    name: 'Home',
    description: 'Landing page with hero and feature overview.',
  },
  {
    path: '/generate/chat',
    name: 'Chat',
    description: 'Conversational assistant. Where users talk to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/generate/video',
    name: 'Chat',
    description: 'Conversational assistant. Where users talk to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/generate/audio',
    name: 'Chat',
    description: 'Conversational assistant. Where users talk to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/generate/text',
    name: 'Chat',
    description: 'Conversational assistant. Where users talk to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/admin/',
    name: 'Chat',
    description: 'Conversational assistant. Where users talk to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/project/',
    name: 'project',
    description: 'Conversational assistant. all generated items are found.',
    tourTarget: '[data-tour="chat-input"]',
  },{
    path: '/editor/[generationId]/',
    name: 'editor',
    description: 'Conversational assistant. edit everything here',
    tourTarget: '[data-tour="chat-input"]',
  },
  {
    path: '/studio/imgtovideo',
    name: 'Studio',
    description: 'Create AI-powered videos from a prompt.',
  },
  {
    path: '/payments/',
    name: 'Payments',
    description: 'Manage your payment methods and billing information.',
  },
  {
    path: '/settings',
    name: 'Settings',
    description: 'Account, billing, and preferences.',
    tourTarget: '[data-tour="account"]',
  },
]

export const SITE_FEATURES: SiteFeature[] = [
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Switch between text, image, audio, video, and chat modes.',
    tourTarget: '[data-tour="sidebar"]',
  },
  {
    id: 'chat-input',
    name: 'Chat input',
    description: 'Type messages to Agnes.',
    tourTarget: '[data-tour="chat-input"]',
    route: '/chat',
  },
  {
    id: 'account',
    name: 'Account menu',
    description: 'Payments, notifications, and settings.',
    tourTarget: '[data-tour="account"]',
  },
]

// Convenience: a compact string to inject into the system prompt.
export function siteMapForPrompt(): string {
  const routes = SITE_ROUTES.map(
    (r) => `- ${r.path} (${r.name}): ${r.description}`
  ).join('\n')
  const features = SITE_FEATURES.map(
    (f) => `- ${f.name}${f.route ? ` [on ${f.route}]` : ''}: ${f.description}`
  ).join('\n')
  return `ROUTES:\n${routes}\n\nFEATURES:\n${features}`
}