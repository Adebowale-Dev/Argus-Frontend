"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconClock,
  IconClipboardList,
  IconFileText,
  IconMaximize,
  IconShield,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { ExamPageShell, PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { Button } from "@/components/ui/button"
import { apiRequest, ApiRequestError } from "@/lib/api/client"
import { getExamSession, setExamAttemptToken, setExamSession } from "@/lib/exam-session"
import type { AntiCheatSettings, AttemptSession } from "@/lib/api/types"
import type { PublicExamInfo } from "./exam-landing"

export function ExamStart({ examCode }: { examCode: string }) {
  const router = useRouter()
  const code = examCode.toUpperCase()

  // Guard: must have candidate info
  useEffect(() => {
    const s = getExamSession(code)
    if (!s.candidateInfo?.fullName && !s.candidateInfo?.email) {
      router.replace(`/exam/${code.toLowerCase()}/details`)
    }
  }, [code, router])

  const examQuery = useQuery({
    queryKey: ["public-exam", code],
    queryFn: () => apiRequest<PublicExamInfo>(`/public/exams/${code}`, {}, { authenticated: false }).then((r) => r.data),
  })

  const [accepted, setAccepted] = useState(false)

  const startMutation = useMutation({
    mutationFn: async () => {
      const s = getExamSession(code)

      // Request fullscreen before calling start, if required
      const exam = examQuery.data
      if (exam?.antiCheatSummary.requiresFullscreen) {
        try {
          await document.documentElement.requestFullscreen()
        } catch {
          // Non-fatal — backend will enforce if needed
        }
      }

      return apiRequest<AttemptSession>(
        `/public/exams/${code}/start`,
        {
          method: "POST",
          body: JSON.stringify({
            examAccessToken: s.examAccessToken,
            emailVerificationToken: s.emailVerificationToken,
            candidate: s.candidateInfo,
            acceptedTerms: true,
            deviceInfo: {
              browser: navigator.userAgent.match(/Chrome|Firefox|Safari|Edge/)?.[0] ?? "Unknown",
              os: navigator.platform,
              userAgent: navigator.userAgent,
            },
            browserFingerprint: `${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}`,
          }),
        },
        { authenticated: false },
      ).then((r) => r.data)
    },
    onSuccess: (session) => {
      const id = session.attempt.id ?? session.attempt._id ?? ""
      if (id && session.attemptToken) {
        setExamAttemptToken(code, id, session.attemptToken)
        setExamSession(code, { attemptId: id, attemptToken: session.attemptToken })
      }
      router.push(`/exam/${code.toLowerCase()}/attempt/${id}`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  if (examQuery.isPending) {
    return (
      <PublicExamLayout step="start">
        <ExamPageShell>
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  const exam = examQuery.data
  if (!exam) return null

  const session = getExamSession(code)
  const ac = exam.antiCheatSummary

  return (
    <PublicExamLayout step="start">
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10">
        <Link
          href={`/exam/${code.toLowerCase()}/details`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" /> Back
        </Link>

        {/* Exam summary */}
        <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm dark:bg-card">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconClock className="size-4" />
              <span>{exam.durationMinutes} minutes</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconClipboardList className="size-4" />
              <span>{exam.questionCount} questions</span>
            </div>
            {exam.totalMarks != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconFileText className="size-4" />
                <span>{exam.totalMarks} marks</span>
              </div>
            )}
          </div>
          {session.candidateInfo?.fullName && (
            <p className="mt-4 text-sm text-muted-foreground">
              Candidate: <strong className="text-foreground">{session.candidateInfo.fullName}</strong>
            </p>
          )}
        </div>

        {/* Instructions */}
        {exam.instructions && (
          <div className="rounded-2xl border bg-white px-6 py-5 dark:bg-card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Instructions</p>
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">{exam.instructions}</p>
          </div>
        )}

        {/* Anti-cheat rules */}
        <div className="rounded-2xl border bg-white px-6 py-5 dark:bg-card">
          <div className="mb-4 flex items-center gap-2">
            <IconShield className="size-5 text-primary" />
            <p className="font-semibold">Anti-Cheat Monitoring</p>
          </div>

          <p className="mb-3 text-sm text-muted-foreground">
            This exam uses ARGUS anti-cheat monitoring. The following restrictions are active:
          </p>

          <div className="space-y-2">
            <AcRule active={ac.requiresFullscreen} label="Fullscreen mode is required" desc="You must stay in fullscreen for the entire exam." />
            <AcRule active={ac.detectsTabSwitching} label="Tab switching is monitored" desc="Leaving this tab will be recorded as a violation." />
            <AcRule active={ac.blocksCopyPaste} label="Copy and paste are disabled" desc="You cannot copy exam content or paste into answer fields." />
            <AcRule active={!!ac.disablesRightClick} label="Right-click is disabled" desc="The context menu is blocked during the exam." />
            <AcRule active={true} label="Browser back button is blocked" desc="Pressing back during the exam may trigger a violation." />
            <AcRule active={ac.webcamRequired} label="Webcam access required" desc="Your camera will be used for identity verification snapshots." />
            <AcRule active={ac.autoSubmitEnabled} label="Auto-submit on violations" desc="Exceeding the violation limit will automatically submit your exam." />
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <IconAlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              If suspicious activity exceeds the allowed limit, your exam will be automatically submitted. All violations are logged and reviewed by the examiner.
            </p>
          </div>
        </div>

        {/* Agreement */}
        <div className="rounded-2xl border bg-white px-6 py-5 dark:bg-card">
          <label className="flex cursor-pointer items-start gap-3">
            <div
              onClick={() => setAccepted((a) => !a)}
              className={`mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-colors ${
                accepted ? "border-primary bg-primary" : "border-muted-foreground/40"
              }`}
            >
              {accepted && <IconCheck className="size-3 text-white" />}
            </div>
            <span className="text-sm leading-6">
              I have read and understood the exam instructions and anti-cheat rules. I agree to follow them for the entire duration of this exam.
            </span>
          </label>
        </div>

        {/* Start button */}
        <Button
          size="lg"
          className="w-full text-base"
          disabled={!accepted || startMutation.isPending}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? "Starting exam…" : "Start Exam"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Once you start, the timer begins immediately and cannot be paused.
        </p>
      </div>
    </PublicExamLayout>
  )
}

function AcRule({ active, label, desc }: { active: boolean; label: string; desc: string }) {
  if (!active) return null
  return (
    <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
      <IconShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
