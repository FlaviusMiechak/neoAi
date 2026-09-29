// lib/agnes.ts
export type AgnesMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AgnesStreamHandlers = {
  onToken?: (token: string) => void
  onDone?: (full: string) => void
  onError?: (err: Error) => void
}

export async function agnesStream(
  messages: AgnesMessage[],
  handlers: AgnesStreamHandlers = {},
  signal?: AbortSignal
): Promise<void> {
  const { onToken, onDone, onError } = handlers

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`Agnes request failed: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let acc = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      acc += decoder.decode(value, { stream: true })
      onToken?.(acc)
    }

    onDone?.(acc)
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
  return data.reply ?? data.content ?? ''
}