// lib/agnesTools.ts

export type ToolName =
  | 'start_full_tour'
  | 'start_tour_at'
  | 'navigate_to'
  | 'highlight_element'
  | 'answer_question'

export type ToolCall = {
  name: ToolName
  args: Record<string, any>
}

// This is what you send to the model in the `tools` field.
export const AGNES_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'start_full_tour',
      description:
        'Start the full guided tour of the entire website, walking through every route and feature in order.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_tour_at',
      description:
        'Start the tour at a specific step id (e.g. "chat", "sidebar", "account").',
      parameters: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            description: 'The tour step id to jump to.',
          },
        },
        required: ['stepId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description:
        'Navigate the user to a route in the app, e.g. "/studio" or "/settings".',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The route path, starting with /.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'highlight_element',
      description:
        'Highlight a UI element by its tour target selector so the user can see it.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector, e.g. [data-tour="sidebar"]',
          },
        },
        required: ['selector'],
      },
    },
  },
]

export function isToolCall(x: any): x is ToolCall {
  return x && typeof x.name === 'string'
}