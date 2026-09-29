
'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAgnes } from '@/components/AgnesProvider'

const SUGGESTIONS = [
  'Write a product launch tweet',
  'Summarize this article',
  'Draft a cold email',
  'Explain quantum computing simply',
]

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
      <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  )
}

export default function Main() {
  const { messages, isStreaming, send } = useAgnes()

  const [input, setInput] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to the latest message as content changes.
  useEffect(() => {
    const container = scrollRef.current

    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isStreaming])

  // Focus the composer when the chat mounts.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Resize the composer based on its content.
  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height =
      `${Math.min(textarea.scrollHeight, 200)}px`
  }, [input])

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()

      if (!trimmed || isStreaming) return

      send(trimmed)
      setInput('')
    },
    [isStreaming, send],
  )

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const visibleMessages = messages.filter((message) => message.role !== 'system')
  const showSuggestions = visibleMessages.length === 0

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#08090d] text-white">
      {/* Chat header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
            <SparkleIcon />
          </span>

          <div>
            <h1 className="text-sm font-semibold text-white">
              Agnes
            </h1>
            <p className="text-[10px] text-white/40">
              AI Assistant
            </p>
          </div>
        </div>

        <span className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-1.5 text-[10px] font-medium text-emerald-300/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Ready to help
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        aria-label="Chat messages"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6 sm:py-10"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {visibleMessages.length === 0 && (
            <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
              <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/15 to-blue-500/[0.04] text-indigo-300 shadow-lg shadow-indigo-500/[0.05]">
                <span className="scale-150">
                  <SparkleIcon />
                </span>
              </div>

              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                What can I help you create?
              </h2>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/45">
                Hi, I&apos;m Agnes. Ask a question, explore an idea,
                or tell me what you want to create.
              </p>
            </div>
          )}

          {visibleMessages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
            />
          ))}

          {isStreaming &&
            visibleMessages[visibleMessages.length - 1]?.content === '' && (
              <div
                className="flex items-center gap-3 pl-1"
                role="status"
                aria-label="Agnes is responding"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
                  <SparkleIcon />
                </span>

                <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <Dot />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#08090d] px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          {showSuggestions && (
            <div className="mb-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  disabled={isStreaming}
                  className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-xs text-white/60 transition hover:border-indigo-400/30 hover:bg-indigo-500/[0.06] hover:text-white disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div
            data-tour="chat-input"
            className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-3 transition focus-within:border-indigo-400/40 focus-within:bg-white/[0.035] focus-within:ring-1 focus-within:ring-indigo-400/10"
          >
            <div className="flex items-end gap-3">
              <span className="mb-1.5 shrink-0 text-indigo-300/70">
                <SparkleIcon />
              </span>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message Agnes..."
                aria-label="Message Agnes"
                className="max-h-[200px] min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/30"
              />

              <button
                type="button"
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/15 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-white/30">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </main>
  )
}

/* ---------- Message components ---------- */

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function MessageBubble({
  message,
}: {
  message: ChatMessage
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-2xl rounded-br-md border border-indigo-400/10 bg-indigo-500 px-4 py-3 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/[0.06] sm:max-w-[80%]">
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
        <SparkleIcon />
      </span>

      <div className="min-w-0 max-w-[90%] pt-1 text-sm leading-7 text-white/85 sm:max-w-[85%]">
        <p className="whitespace-pre-wrap break-words">
          {message.content || '\u00A0'}
        </p>
      </div>
    </div>
  )
}

function Dot({
  delay = '0ms',
}: {
  delay?: string
}) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300/70"
      style={{ animationDelay: delay }}
    />
  )
}