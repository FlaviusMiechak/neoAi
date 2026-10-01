// lib/agnes.ts
import type { ToolCall } from './agnesTools'

export type AgnesMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AgnesStreamHandlers = {
  onToken?: (token: string) => void
  onDone?: (full: string) => void
  onError?: (err: Error) => void
  onTool?: (tool: ToolCall) => void
}

export async function agnesStream(
  messages: AgnesMessage[],
  handlers: AgnesStreamHandlers = {},
  signal?: AbortSignal
): Promise<void> {
  const { onToken, onDone, onError, onTool } = handlers

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(
        data?.error?.message ||
          data?.error ||
          `Agnes request failed: ${res.status}`
      )
    }

    const data = await res.json().catch(() => ({}))

    // Tool call path
    if (data?.tool) {
      const text = (data.reply ?? '').trim()
      if (text) onToken?.(text)
      onTool?.(data.tool)
      onDone?.(text)
      return
    }

    // Plain reply path
    const reply: string = (data?.reply ?? '').trim()
    onToken?.(reply)
    onDone?.(reply)
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
  }
}

export async function agnesOnce(messages: AgnesMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error(`Agnes request failed: ${res.status}`)
  const data = await res.json()
  return (data.reply ?? '').trim()
}