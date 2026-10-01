import { NextRequest, NextResponse } from 'next/server'
import { siteMapForPrompt } from '@/lib/siteMap'
import { AGNES_TOOLS } from '@/lib/agnesTools'

const AGNES_BASE = 'https://apihub.agnes-ai.com'
const AGNES_MODE = 'agnes-2.0-flash'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const SYSTEM_PROMPT = `You are Agnes, the built-in guide for this website.

You know every route and feature of the site. You can:
- Answer questions about how the site works.
- Start a guided tour when the user asks (e.g. "show me around", "give me a tour", "what is this site").
- Navigate the user to any route.
- Highlight any UI element.

When the user asks for a tour, ALWAYS call the start_full_tour tool.
When the user asks about a specific feature, call start_tour_at or highlight_element.
When the user asks to go somewhere, call navigate_to.
Otherwise, just answer in plain text.

Here is the complete map of the site:

${siteMapForPrompt()}

Keep replies short and friendly. Never invent routes or features that are not in the map above.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages: ChatMessage[] = body?.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages must be a non-empty array' },
        { status: 400 }
      )
    }

    const apiKey = process.env.AGNES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AGNES_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const upstream = await fetch(`${AGNES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AGNES_MODE,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools: AGNES_TOOLS,
        tool_choice: 'auto',
      }),
    })

    const raw = await upstream.text()

    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON response', raw },
        { status: 502 }
      )
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data },
        { status: upstream.status }
      )
    }

    const choice = data.choices?.[0]
    const toolCall = choice?.message?.tool_calls?.[0]

    // If the model decided to call a tool, forward that to the client.
    if (toolCall) {
      const name = toolCall.function?.name
      let args: Record<string, any> = {}
      try {
        args = JSON.parse(toolCall.function?.arguments ?? '{}')
      } catch {
        // ignore — leave args empty
      }
      return NextResponse.json({
        tool: { name, args },
        reply: choice?.message?.content ?? '',
      })
    }

    const reply = (choice?.message?.content ?? '').trim()
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('[chat] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}