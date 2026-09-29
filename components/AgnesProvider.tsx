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
import { agnesStream, agnesOnce, type AgnesMessage } from '@/lib/agnes'

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
}

const AgnesContext = createContext<AgnesContextValue | null>(null)
AgnesContext.displayName = 'AgnesContext'

const DEFAULT_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: "Hi, I'm Agnes 👋",
    body: "I'll show you around in a few quick steps. You can talk to me any time from the chat panel on the right.",
    placement: 'center',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Your sidebar',
    body: 'Switch between modes here — text, image, audio, video, and chat.',
    placement: 'right',
  },
  {
    id: 'chat',
    target: '[data-tour="chat-input"]',
    title: 'Ask me anything',
    body: 'Type here to start a conversation. I can help you draft, generate, and refine.',
    placement: 'top',
  },
  {
    id: 'account',
    target: '[data-tour="account"]',
    title: 'Your account',
    body: 'Payments, notifications, and settings live here.',
    placement: 'bottom',
  },
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

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      setError(null)
      const userMsg: AgnesMessage = { role: 'user', content: trimmed }
      const assistantIndex = messages.length + 1

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: 'assistant', content: '' },
      ])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      await agnesStream(
        [...messages, userMsg],
        {
          onToken: (full) => {
            setMessages((prev) => {
              const copy = [...prev]
              copy[assistantIndex] = { role: 'assistant', content: full }
              return copy
            })
          },
          onDone: () => setIsStreaming(false),
          onError: (err) => {
            setError(err.message)
            setIsStreaming(false)
          },
        },
        controller.signal
      )
    },
    [messages]
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

  // --- Tour controls ---
  const startTour = useCallback(() => {
    setTourStepIndex(0)
    setTourOpen(true)
  }, [])

  const nextStep = useCallback(() => {
    setTourStepIndex((i) => {
      const next = i + 1
      if (next >= tour.length) {
        setTourOpen(false)
        localStorage.setItem('agnes:tour:seen', '1')
        return i
      }
      return next
    })
  }, [tour.length])

  const prevStep = useCallback(() => {
    setTourStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const skipTour = useCallback(() => {
    setTourOpen(false)
    localStorage.setItem('agnes:tour:seen', '1')
  }, [])

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
      const el = document.querySelector(currentStep.target!) as HTMLElement | null
      if (el) {
        attach(el)
      } else if (attempts++ < 30) {
        raf = requestAnimationFrame(tryFind)
      } else {
        // Give up — advance to the next step
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

  // ---- Bubble position ----
  const bubbleWidth = 320
  const bubbleHeightEstimate = 200
  const gap = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  const clampX = (x: number) => Math.min(Math.max(x, 12), vw - bubbleWidth - 12)
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
      {/* Dim + spotlight — non-interactive */}
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

      {/* Click-catcher — closes on outside click */}
      <button
        type="button"
        aria-label="Close tour"
        tabIndex={-1}
        onClick={skipTour}
        className="absolute inset-0 cursor-default"
      />

      {/* Bubble — interactive */}
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