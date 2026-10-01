// components/AgnesProvider.tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  agnesStream,
  agnesOnce,
  type AgnesMessage,
} from '@/lib/agnes'
import type { ToolCall } from '@/lib/agnesTools'
import { SITE_FEATURES, SITE_ROUTES } from '@/lib/siteMap'

// Re-export AgnesMessage under the name Main.tsx expects.
export type ChatMessage = AgnesMessage

export type TourStep = {
  id: string
  target?: string
  title: string
  body: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

type AgnesContextValue = {
  messages: AgnesMessage[]
  isStreaming: boolean
  error: string | null
  send: (content: string) => Promise<void>
  sendOnce: (content: string) => Promise<string>
  stop: () => void
  reset: () => void

  tourOpen: boolean
  tourStepIndex: number
  currentStep: TourStep | null
  startTour: () => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void

  // PATCH: exposed so the assistant (and any component) can drive the UI.
  navigate: (path: string) => void
  highlight: (selector: string) => void
}

const AgnesContext = createContext<AgnesContextValue | null>(null)
AgnesContext.displayName = 'AgnesContext'

// PATCH: build the default tour from the site map so it always
// covers every route and feature. Add to lib/siteMap.ts — not here.
const DEFAULT_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: "Hi, I'm Agnes 👋",
    body: "I'll show you around the whole site in a few quick steps. You can talk to me any time from the chat panel on the right.",
    placement: 'center',
  },
  ...SITE_FEATURES.map<TourStep>((f) => ({
    id: f.id,
    target: f.tourTarget,
    title: f.name,
    body: f.description,
    placement: 'bottom',
  })),
  ...SITE_ROUTES.filter((r) => r.tourTarget).map<TourStep>((r) => ({
    id: `route-${r.path}`,
    target: r.tourTarget,
    title: `${r.name} — ${r.path}`,
    body: r.description,
    placement: 'right',
  })),
]

export function AgnesProvider({
  children,
  tour = DEFAULT_TOUR,
  autoStartForNewUsers = true,
}: {
  children: React.ReactNode
  tour?: TourStep[]
  autoStartForNewUsers?: boolean
}) {
  const router = useRouter()

  const [messages, setMessages] = useState<AgnesMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [tourOpen, setTourOpen] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)

  // Auto-start the tour for first-time users (after layout is stable)
  useEffect(() => {
    if (!autoStartForNewUsers) return
    const seen = localStorage.getItem('agnes:tour:seen')
    if (!seen) {
      const t = setTimeout(() => setTourOpen(true), 1200)
      return () => clearTimeout(t)
    }
  }, [autoStartForNewUsers])

  // --- Chat ---
  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setMessages([])
    setError(null)
  }, [stop])

  // --- Tour controls (declared before send so handleTool can use them) ---
  const startTour = useCallback(() => {
    setTourStepIndex(0)
    setTourOpen(true)
  }, [])

  const nextStep = useCallback(() => {
    setTourStepIndex((i) => {
      const nxt = i + 1
      if (nxt >= tour.length) {
        setTourOpen(false)
        localStorage.setItem('agnes:tour:seen', '1')
        return i
      }
      return nxt
    })
  }, [tour.length])

  const prevStep = useCallback(() => {
    setTourStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const skipTour = useCallback(() => {
    setTourOpen(false)
    localStorage.setItem('agnes:tour:seen', '1')
  }, [])

  // --- PATCH: UI driver functions the assistant can invoke ---
  const navigate = useCallback(
    (path: string) => {
      if (!path || typeof path !== 'string') return
      router.push(path)
    },
    [router]
  )

  const highlight = useCallback((selector: string) => {
    if (!selector || typeof selector !== 'string') return
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const prevTransition = el.style.transition
    const prevShadow = el.style.boxShadow
    el.style.transition = 'box-shadow 200ms ease'
    el.style.boxShadow =
      '0 0 0 3px #4d6bfe, 0 0 0 8px rgba(77,107,254,0.25)'
    window.setTimeout(() => {
      el.style.boxShadow = prevShadow
      el.style.transition = prevTransition
    }, 2000)
  }, [])

  // --- PATCH: execute a tool call from the model ---
  const handleTool = useCallback(
    (tool: ToolCall) => {
      switch (tool.name) {
        case 'start_full_tour':
          startTour()
          break

        case 'start_tour_at': {
          const stepId = tool.args?.stepId as string | undefined
          const idx = stepId
            ? tour.findIndex((s) => s.id === stepId)
            : -1
          if (idx >= 0) {
            setTourStepIndex(idx)
            setTourOpen(true)
          } else {
            startTour()
          }
          break
        }

        case 'navigate_to':
          navigate(tool.args?.path as string)
          break

        case 'highlight_element':
          highlight(tool.args?.selector as string)
          break

        default:
          // Unknown tool — ignore silently.
          break
      }
    },
    [startTour, tour, navigate, highlight]
  )

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      setError(null)
      const userMsg: AgnesMessage = { role: 'user', content: trimmed }

      const history = messages
      const next = [...history, userMsg]
      const assistantIndex = next.length

      setMessages([...next, { role: 'assistant', content: '' }])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      await agnesStream(
        next,
        {
          onToken: (full) => {
            setMessages((prev) => {
              const copy = [...prev]
              copy[assistantIndex] = {
                role: 'assistant',
                content: full,
              }
              return copy
            })
          },
          // PATCH: forward tool calls to the UI driver.
          onTool: handleTool,
          onDone: () => {
            setIsStreaming(false)
            abortRef.current = null
          },
          onError: (err) => {
            setError(err.message)
            setIsStreaming(false)
            abortRef.current = null
            setMessages((prev) => {
              const copy = [...prev]
              if (
                copy[assistantIndex] &&
                copy[assistantIndex].role === 'assistant' &&
                copy[assistantIndex].content === ''
              ) {
                copy[assistantIndex] = {
                  role: 'assistant',
                  content: `⚠️ ${err.message}`,
                }
              }
              return copy
            })
          },
        },
        controller.signal
      )
    },
    [messages, handleTool]
  )

  const sendOnce = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return ''
      setError(null)
      const userMsg: AgnesMessage = { role: 'user', content: trimmed }
      const reply = await agnesOnce([...messages, userMsg])
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: 'assistant', content: reply },
      ])
      return reply
    },
    [messages]
  )

  const currentStep = tourOpen ? tour[tourStepIndex] ?? null : null

  const value = useMemo<AgnesContextValue>(
    () => ({
      messages,
      isStreaming,
      error,
      send,
      sendOnce,
      stop,
      reset,
      tourOpen,
      tourStepIndex,
      currentStep,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      navigate,
      highlight,
    }),
    [
      messages,
      isStreaming,
      error,
      send,
      sendOnce,
      stop,
      reset,
      tourOpen,
      tourStepIndex,
      currentStep,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      navigate,
      highlight,
    ]
  )

  return (
    <AgnesContext.Provider value={value}>
      {children}
      {tourOpen && <TourOverlay />}
    </AgnesContext.Provider>
  )
}

export function useAgnes() {
  const ctx = useContext(AgnesContext)
  if (!ctx) {
    throw new Error(
      '[useAgnes] No AgnesProvider in the tree. Wrap your layout with <AgnesProvider>.'
    )
  }
  return ctx
}

/* -------------------------------------------------------------------------- */
/*  Tour overlay                                                              */
/* -------------------------------------------------------------------------- */

function TourOverlay() {
  const ctx = useContext(AgnesContext)!
  const {
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    tourStepIndex,
    tourOpen,
  } = ctx

  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Track the target element (with retry + auto-advance if missing)
  useLayoutEffect(() => {
    if (!tourOpen || !currentStep) return

    if (!currentStep.target) {
      setRect(null)
      return
    }

    let cleanup = () => {}
    let raf = 0
    let attempts = 0

    const attach = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setRect(el.getBoundingClientRect())

      const update = () => setRect(el.getBoundingClientRect())
      const ro = new ResizeObserver(update)
      ro.observe(el)
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, true)

      cleanup = () => {
        ro.disconnect()
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update, true)
      }
    }

    const tryFind = () => {
      const el = document.querySelector(
        currentStep.target!
      ) as HTMLElement | null
      if (el) {
        attach(el)
      } else if (attempts++ < 30) {
        raf = requestAnimationFrame(tryFind)
      } else {
        nextStep()
      }
    }

    tryFind()

    return () => {
      cancelAnimationFrame(raf)
      cleanup()
    }
  }, [currentStep, tourOpen, nextStep])

  // Keyboard: Escape, ArrowLeft/Right
  useEffect(() => {
    if (!tourOpen) return
    const nextBtn = bubbleRef.current?.querySelector<HTMLButtonElement>(
      '[data-tour-next]'
    )
    nextBtn?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') skipTour()
      else if (e.key === 'ArrowRight') nextStep()
      else if (e.key === 'ArrowLeft') prevStep()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tourOpen, tourStepIndex, skipTour, nextStep, prevStep])

  if (!mounted || !tourOpen || !currentStep) return null

  const pad = 8

  const bubbleWidth = 320
  const bubbleHeightEstimate = 200
  const gap = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  const clampX = (x: number) =>
    Math.min(Math.max(x, 12), vw - bubbleWidth - 12)
  const clampY = (y: number) =>
    Math.min(Math.max(y, 12), vh - bubbleHeightEstimate - 12)

  let bubbleStyle: React.CSSProperties = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  }

  if (rect && currentStep.placement && currentStep.placement !== 'center') {
    switch (currentStep.placement) {
      case 'top':
        bubbleStyle = {
          left: clampX(rect.left + rect.width / 2 - bubbleWidth / 2),
          top: clampY(rect.top - pad - gap - bubbleHeightEstimate),
        }
        break
      case 'bottom':
        bubbleStyle = {
          left: clampX(rect.left + rect.width / 2 - bubbleWidth / 2),
          top: clampY(rect.bottom + pad + gap),
        }
        break
      case 'left':
        bubbleStyle = {
          left: clampX(rect.left - pad - bubbleWidth - gap),
          top: clampY(rect.top + rect.height / 2 - bubbleHeightEstimate / 2),
        }
        break
      case 'right':
        bubbleStyle = {
          left: clampX(rect.right + pad + gap),
          top: clampY(rect.top + rect.height / 2 - bubbleHeightEstimate / 2),
        }
        break
    }
  }

  const overlay = (
    <div className="fixed inset-0 z-[9999]">
      <div className="pointer-events-none absolute inset-0">
        {rect ? (
          <div
            className="absolute rounded-xl ring-2 ring-[#4d6bfe] transition-all duration-200"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.6)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-slate-950/60" />
        )}
      </div>

      <button
        type="button"
        aria-label="Close tour"
        tabIndex={-1}
        onClick={skipTour}
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        className="pointer-events-auto absolute w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0b0d12]"
        style={bubbleStyle}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[#4d6bfe]">
          Step {tourStepIndex + 1}
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
          {currentStep.title}
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {currentStep.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              skipTour()
            }}
            className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            Skip
          </button>

          <div className="flex gap-2">
            {tourStepIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prevStep()
                }}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              data-tour-next
              onClick={(e) => {
                e.stopPropagation()
                nextStep()
              }}
              className="rounded-full bg-[#4d6bfe] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3f5af0]"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}