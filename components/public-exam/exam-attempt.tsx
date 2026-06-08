"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconMaximize,
  IconSend,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiRequestError, attemptRequest } from "@/lib/api/client"
import type { AttemptSession, Question } from "@/lib/api/types"

type ViolationResponse = { action: string; violationScore: number; warningCount?: number; reason?: string }
type SaveStatus = "idle" | "saving" | "saved" | "error"
type WarningLevel = "none" | "warning" | "final-warning" | "auto-submit"

// ─── Clock hook ───────────────────────────────────────────────────────────────
function useSecondClock() {
  return useSyncExternalStore(
    (cb) => { const id = setInterval(cb, 1000); return () => clearInterval(id) },
    () => Math.floor(Date.now() / 1000),
    () => 0,
  )
}

function fmtTime(secs: number) {
  const s = Math.max(0, secs)
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

// ─── ExamAttempt ──────────────────────────────────────────────────────────────
export function ExamAttempt() {
  const { examCode, attemptId } = useParams<{ examCode: string; attemptId: string }>()
  const router = useRouter()
  const clock = useSecondClock()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [warningLevel, setWarningLevel] = useState<WarningLevel>("none")
  const [warningMessage, setWarningMessage] = useState("")
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const expiryFired = useRef(false)
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load attempt session — uses attempt token automatically via attemptRequest
  const sessionQuery = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () =>
      attemptRequest<AttemptSession>(attemptId, `/attempts/${attemptId}`).then((r) => r.data),
    retry: false,
    staleTime: Infinity,
  })

  const attempt = sessionQuery.data?.attempt
  const settings = sessionQuery.data?.exam?.antiCheatSettings
  const questions = sessionQuery.data?.questions ?? []
  const question = questions[currentIndex]
  const remaining = attempt ? Math.max(0, Math.floor(new Date(attempt.expiresAt).getTime() / 1000) - clock) : 0

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string[] }) =>
      attemptRequest(attemptId, `/attempts/${attemptId}/save-answer`, {
        method: "POST",
        body: JSON.stringify({ questionId, answer, currentQuestionIndex: currentIndex }),
      }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => setSaveStatus("saved"),
    onError: () => setSaveStatus("error"),
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      attemptRequest(attemptId, `/attempts/${attemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: questions.map((q) => ({
            questionId: q.id ?? q._id,
            answer: getAnswer(q),
          })),
        }),
      }),
    onSuccess: () => {
      toast.success("Exam submitted successfully.")
      router.replace(`/exam/${examCode}/submitted`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const violationMutation = useMutation({
    mutationFn: (payload: { eventType: string; metadata?: Record<string, unknown> }) =>
      attemptRequest<ViolationResponse>(attemptId, `/attempts/${attemptId}/anti-cheat/log`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          questionIndex: currentIndex,
          timeRemaining: remaining,
        }),
      }).then((r) => r.data),
    onSuccess: (data) => {
      if (data.action === "AUTO_SUBMIT") {
        setAutoSubmitted(true)
        setWarningLevel("auto-submit")
        setWarningMessage(data.reason ?? "You have been auto-submitted.")
        // Save final answers then redirect
        submitMutation.mutate()
      } else if (data.action === "FINAL_WARNING") {
        setWarningLevel("final-warning")
        setWarningMessage("One more violation will automatically submit your exam.")
      } else if (data.action === "WARNING") {
        setWarningLevel("warning")
        setWarningMessage(`You left the exam environment. This has been recorded. (${data.warningCount ?? 1} warning${(data.warningCount ?? 1) > 1 ? "s" : ""})`)
      }
    },
  })

  const heartbeatMutation = useMutation({
    mutationFn: () =>
      attemptRequest(attemptId, `/attempts/${attemptId}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({ currentQuestionIndex: currentIndex }),
      }),
  })

  // ── Heartbeat ──
  useEffect(() => {
    if (attempt?.status !== "IN_PROGRESS") return
    const id = setInterval(() => heartbeatMutation.mutate(), 20000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.status, attemptId])

  // ── Timer expiry ──
  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS" || remaining > 0 || expiryFired.current) return
    expiryFired.current = true
    submitMutation.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, attempt?.status])

  // ── Anti-cheat event listeners ──
  useEffect(() => {
    if (attempt?.status !== "IN_PROGRESS" || autoSubmitted) return

    function record(eventType: string, metadata?: Record<string, unknown>) {
      violationMutation.mutate({ eventType, metadata })
    }

    const onVisibility = () => {
      if (document.hidden && settings?.detectTabSwitch !== false)
        record("TAB_SWITCHED", { message: "Candidate switched away from exam tab." })
    }
    const onFullscreen = () => {
      if (!document.fullscreenElement && settings?.requireFullscreen)
        record("FULLSCREEN_EXITED", { message: "Fullscreen exited." })
    }
    const onBlur = () => {
      if (settings?.detectWindowBlur !== false)
        record("WINDOW_BLUR", { message: "Exam window lost focus." })
    }
    const onCopy = (e: ClipboardEvent) => {
      if (settings?.disableCopyPaste !== false) { e.preventDefault(); record("COPY_ATTEMPT") }
    }
    const onPaste = (e: ClipboardEvent) => {
      if (settings?.disableCopyPaste !== false) { e.preventDefault(); record("PASTE_ATTEMPT") }
    }
    const onCut = (e: ClipboardEvent) => {
      if (settings?.disableCopyPaste !== false) { e.preventDefault(); record("CUT_ATTEMPT") }
    }
    const onContextMenu = (e: MouseEvent) => {
      if (settings?.disableRightClick !== false) { e.preventDefault(); record("RIGHT_CLICK_ATTEMPT") }
    }
    const onKeydown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === "p") { e.preventDefault(); record("PRINT_ATTEMPT") }
      if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); record("SAVE_ATTEMPT") }
      if (e.key === "F5" || (ctrl && e.key.toLowerCase() === "r")) { e.preventDefault(); record("PAGE_REFRESH_ATTEMPT") }
      if (settings?.blockDevToolsShortcuts !== false &&
        (e.key === "F12" || (ctrl && e.shiftKey && ["i","j","c"].includes(e.key.toLowerCase())))) {
        e.preventDefault(); record("DEVTOOLS_ATTEMPT")
      }
    }
    const onPopstate = () => record("BROWSER_BACK_ATTEMPT")

    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onFullscreen)
    window.addEventListener("blur", onBlur)
    document.addEventListener("copy", onCopy as EventListener)
    document.addEventListener("paste", onPaste as EventListener)
    document.addEventListener("cut", onCut as EventListener)
    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("keydown", onKeydown)
    window.addEventListener("popstate", onPopstate)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("fullscreenchange", onFullscreen)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("copy", onCopy as EventListener)
      document.removeEventListener("paste", onPaste as EventListener)
      document.removeEventListener("cut", onCut as EventListener)
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("keydown", onKeydown)
      window.removeEventListener("popstate", onPopstate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.status, autoSubmitted, settings])

  // ── Helpers ──
  function getAnswer(q: Question): string[] {
    const id = q.id ?? q._id ?? ""
    return answers[id] ?? attempt?.answers?.find((a) => String(a.question) === id)?.answer ?? []
  }

  function selectAnswer(q: Question, values: string[]) {
    const id = q.id ?? q._id ?? ""
    setAnswers((cur) => ({ ...cur, [id]: values }))
    setSaveStatus("saving")
    if (saveDebounce.current) clearTimeout(saveDebounce.current)
    saveDebounce.current = setTimeout(() => {
      saveMutation.mutate({ questionId: id, answer: values })
    }, 400)
  }

  function toggleFlag(idx: number) {
    setFlagged((cur) => { const n = new Set(cur); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }

  const answeredCount = questions.filter((q) => getAnswer(q).length > 0).length
  const unanswered = questions.length - answeredCount

  // ── Loading ──
  if (sessionQuery.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f8f9fc] dark:bg-[#0d0f14]">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading secure exam…</p>
        </div>
      </div>
    )
  }

  if (!attempt || !question) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="max-w-sm text-center">
          <IconAlertTriangle className="mx-auto size-10 text-destructive" />
          <p className="mt-2 font-medium">Attempt unavailable</p>
          <p className="text-sm text-muted-foreground">This attempt cannot be loaded or is no longer active.</p>
        </div>
      </div>
    )
  }

  const answer = getAnswer(question)
  const isLocked = attempt.status !== "IN_PROGRESS" || autoSubmitted

  return (
    <div className="flex min-h-svh flex-col bg-[#f8f9fc] select-none dark:bg-[#0d0f14]"
      onContextMenu={(e) => { if (settings?.disableRightClick !== false) e.preventDefault() }}
    >
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-white/95 backdrop-blur dark:bg-[#111318]/95">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          {/* Exam title + candidate */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {sessionQuery.data?.exam?.title ?? "Exam"}
            </p>
            {attempt && (
              <p className="text-[11px] text-muted-foreground truncate">
                {(attempt as unknown as { candidateProfile?: { fullName?: string } }).candidateProfile?.fullName ?? "Candidate"}
              </p>
            )}
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-mono font-bold tabular-nums ${
            remaining < 300 ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400" :
            remaining < 600 ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400" :
            "border-border bg-muted/40 text-foreground"
          }`}>
            <span className={`size-2 rounded-full ${remaining < 300 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            {fmtTime(remaining)}
          </div>

          {/* Save status */}
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            {saveStatus === "saving" && <><span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />Saving…</>}
            {saveStatus === "saved" && <><span className="size-1.5 rounded-full bg-emerald-500" />Saved</>}
            {saveStatus === "error" && <><span className="size-1.5 rounded-full bg-red-500" />Save failed</>}
          </div>

          {/* Fullscreen + Submit */}
          <div className="flex items-center gap-2">
            {settings?.requireFullscreen && (
              <button
                type="button"
                onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
                className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted sm:flex"
              >
                <IconMaximize className="size-3.5" />Fullscreen
              </button>
            )}
            <button
              type="button"
              disabled={isLocked || submitMutation.isPending}
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <IconSend className="size-3.5" />Submit
            </button>
          </div>
        </div>

        {/* Question progress bar */}
        <div className="h-1 bg-muted/40">
          <div
            className="h-1 bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 gap-0 lg:flex-row">
        {/* Question panel */}
        <div className="flex flex-1 flex-col px-4 py-6 lg:px-8">
          {/* Question header */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </span>
              {question.questionType === "MULTIPLE_CHOICE" && (
                <span className="ml-2 text-xs text-muted-foreground">(Select all that apply)</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFlag(currentIndex)}
              className={`flex items-center gap-1 text-xs font-medium ${flagged.has(currentIndex) ? "text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
            >
              <IconFlag className="size-3.5" />
              {flagged.has(currentIndex) ? "Flagged" : "Flag for review"}
            </button>
          </div>

          {/* Question text */}
          <div className="mb-6 rounded-xl border bg-white px-5 py-4 shadow-sm dark:bg-card">
            <p className="text-base leading-7 text-foreground">{question.questionText}</p>
          </div>

          {/* Answer options */}
          <div className="space-y-3">
            {question.questionType === "MULTIPLE_CHOICE" ? (
              question.options.map((opt) => {
                const selected = answer.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      const next = selected ? answer.filter((k) => k !== opt.key) : [...answer, opt.key]
                      selectAnswer(question, next)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      selected
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-white hover:border-primary/30 hover:bg-primary/5 dark:bg-card"
                    }`}
                  >
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded border-2 text-xs font-bold ${
                      selected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                    }`}>
                      {selected ? <IconCheck className="size-3" /> : opt.key}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </button>
                )
              })
            ) : (
              question.options.map((opt) => {
                const selected = answer[0] === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => selectAnswer(question, [opt.key])}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      selected
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-white hover:border-primary/30 hover:bg-primary/5 dark:bg-card"
                    }`}
                  >
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {selected && <span className="size-2 rounded-full bg-white" />}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Prev/Next */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
            >
              <IconChevronLeft className="size-4" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">{answeredCount} / {questions.length} answered</span>
            <button
              type="button"
              disabled={currentIndex === questions.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
            >
              Next <IconChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Navigation sidebar */}
        <aside className="hidden w-56 shrink-0 border-l bg-white px-4 py-6 dark:bg-card lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions</p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, idx) => {
              const ans = getAnswer(q)
              const isActive = idx === currentIndex
              const isAnswered = ans.length > 0
              const isFlagged = flagged.has(idx)
              return (
                <button
                  key={q.id ?? q._id ?? idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  title={`Question ${idx + 1}${isFlagged ? " (flagged)" : ""}`}
                  className={`flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" :
                    isFlagged ? "border-2 border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                    isAnswered ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/40" :
                    "border border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="size-3 rounded bg-emerald-100 ring-1 ring-emerald-300" />Answered</div>
            <div className="flex items-center gap-2"><span className="size-3 rounded border-2 border-amber-400 bg-amber-50" />Flagged</div>
            <div className="flex items-center gap-2"><span className="size-3 rounded border border-border bg-muted/40" />Not answered</div>
          </div>

          {/* Flagged list */}
          {flagged.size > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold text-amber-600">Flagged for review</p>
              <div className="space-y-1">
                {Array.from(flagged).sort((a, b) => a - b).map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security badge */}
          <div className="mt-6 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-primary">
            <IconShieldCheck className="size-3.5 shrink-0" />
            <span>ARGUS monitored</span>
          </div>
        </aside>
      </div>

      {/* ── Submit modal ── */}
      {showSubmitModal && (
        <Modal onClose={() => setShowSubmitModal(false)}>
          <div className="p-6">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <IconSend className="size-6 text-primary" />
            </div>
            <h2 className="mt-3 text-lg font-bold">Submit Exam?</h2>
            {unanswered > 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                You still have <strong className="text-foreground">{unanswered} unanswered question{unanswered > 1 ? "s" : ""}</strong>. Unanswered questions will score zero.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                You have answered all {questions.length} questions.
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">Once submitted, you cannot change your answers.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Exam"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Warning modal ── */}
      {warningLevel !== "none" && warningLevel !== "auto-submit" && (
        <Modal onClose={() => setWarningLevel("none")}>
          <div className="p-6">
            <div className={`flex size-12 items-center justify-center rounded-xl ${warningLevel === "final-warning" ? "bg-red-100 dark:bg-red-950/30" : "bg-amber-100 dark:bg-amber-950/30"}`}>
              <IconAlertTriangle className={`size-6 ${warningLevel === "final-warning" ? "text-red-600" : "text-amber-600"}`} />
            </div>
            <h2 className="mt-3 text-lg font-bold">
              {warningLevel === "final-warning" ? "Final Warning" : "Warning"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{warningMessage}</p>
            {warningLevel === "final-warning" && (
              <p className="mt-2 text-sm font-medium text-red-600">Another violation will automatically submit your exam.</p>
            )}
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              onClick={() => setWarningLevel("none")}
            >
              Return to Exam
            </button>
          </div>
        </Modal>
      )}

      {/* ── Auto-submit screen ── */}
      {warningLevel === "auto-submit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-card">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/30">
              <IconAlertTriangle className="size-8 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Exam Auto-Submitted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your exam was automatically submitted because the anti-cheat violation limit was exceeded. Your saved answers have been submitted for review.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{warningMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-card">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <IconX className="size-4" />
        </button>
        {children}
      </div>
    </div>
  )
}
