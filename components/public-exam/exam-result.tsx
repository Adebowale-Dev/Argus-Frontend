"use client"

import Link from "next/link"
import {
  IconAlertCircle,
  IconCheck,
  IconClockOff,
  IconShieldCheck,
  IconTrophy,
  IconX,
} from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"

import { PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { Button } from "@/components/ui/button"
import { attemptRequest } from "@/lib/api/client"
import { getExamSession } from "@/lib/exam-session"

type AttemptResult = {
  attempt: {
    id: string
    status: string
    score?: number
    percentageScore?: number
    passed?: boolean
    timeSpent?: number
    submittedAt?: string
    questionCount?: number
    correctCount?: number
    wrongCount?: number
    unansweredCount?: number
  }
  exam: {
    title: string
    passMark?: number
    totalMarks?: number
    showResultImmediately?: boolean
  }
}

export function ExamResult({ examCode }: { examCode: string }) {
  const code = examCode.toUpperCase()
  const session = getExamSession(code)
  const attemptId = session.attemptId

  const resultQuery = useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: () =>
      attemptRequest<AttemptResult>(attemptId!, `/attempts/${attemptId}/result`).then((r) => r.data),
    enabled: !!attemptId,
    retry: 1,
  })

  if (!attemptId) {
    return (
      <PublicExamLayout step="result" hideSteps>
        <div className="flex min-h-[calc(100svh-80px)] items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <IconAlertCircle className="mx-auto size-10 text-destructive" />
            <p className="mt-2 font-medium">No attempt found</p>
            <p className="mt-1 text-sm text-muted-foreground">We could not find your exam attempt. Please check the exam link.</p>
            <Link href="/exam" className="mt-4 inline-block">
              <Button variant="outline">Return to exam finder</Button>
            </Link>
          </div>
        </div>
      </PublicExamLayout>
    )
  }

  if (resultQuery.isPending) {
    return (
      <PublicExamLayout step="result" hideSteps>
        <div className="flex min-h-[calc(100svh-80px)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Loading results…</p>
          </div>
        </div>
      </PublicExamLayout>
    )
  }

  if (resultQuery.isError || !resultQuery.data) {
    return (
      <PublicExamLayout step="result" hideSteps>
        <div className="flex min-h-[calc(100svh-80px)] items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <IconClockOff className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-2 font-medium">Results not available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Results are not yet available for this exam. Contact your examiner for more information.
            </p>
            <Link href="/exam" className="mt-4 inline-block">
              <Button variant="outline">Return to exam finder</Button>
            </Link>
          </div>
        </div>
      </PublicExamLayout>
    )
  }

  const { attempt, exam } = resultQuery.data
  const passed = attempt.passed ?? false
  const pct = attempt.percentageScore ?? (exam.totalMarks && attempt.score ? Math.round((attempt.score / exam.totalMarks) * 100) : null)

  function fmtTime(secs?: number) {
    if (!secs) return "—"
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }

  return (
    <PublicExamLayout step="result" hideSteps>
      <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-12">
        {/* Score card */}
        <div className="rounded-2xl border bg-white px-6 py-8 text-center shadow-sm dark:bg-card">
          {/* Trophy / X icon */}
          <div className={`mx-auto flex size-20 items-center justify-center rounded-3xl ${passed ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
            {passed
              ? <IconTrophy className="size-10 text-emerald-600" />
              : <IconX className="size-10 text-red-600" />
            }
          </div>

          <h1 className="mt-4 text-2xl font-bold">{exam.title}</h1>

          {pct != null && (
            <div className="mt-4">
              <span className={`text-5xl font-black tabular-nums ${passed ? "text-emerald-600" : "text-red-600"}`}>
                {pct}%
              </span>
              {exam.totalMarks && attempt.score != null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {attempt.score} / {exam.totalMarks} marks
                </p>
              )}
            </div>
          )}

          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
            passed
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/40"
              : "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900/40"
          }`}>
            {passed ? <IconCheck className="size-4" /> : <IconX className="size-4" />}
            {passed ? "Passed" : "Not Passed"}
          </div>

          {exam.passMark != null && (
            <p className="mt-2 text-xs text-muted-foreground">Pass mark: {exam.passMark}</p>
          )}
        </div>

        {/* Stats grid */}
        {(attempt.correctCount != null || attempt.wrongCount != null || attempt.timeSpent != null) && (
          <div className="grid grid-cols-3 gap-3">
            {attempt.correctCount != null && (
              <StatCard label="Correct" value={`${attempt.correctCount}`} color="emerald" />
            )}
            {attempt.wrongCount != null && (
              <StatCard label="Wrong" value={`${attempt.wrongCount}`} color="red" />
            )}
            {attempt.unansweredCount != null && (
              <StatCard label="Skipped" value={`${attempt.unansweredCount}`} color="muted" />
            )}
            {attempt.timeSpent != null && (
              <StatCard label="Time spent" value={fmtTime(attempt.timeSpent)} color="muted" />
            )}
          </div>
        )}

        {/* Candidate */}
        {session.candidateInfo?.fullName && (
          <p className="text-center text-sm text-muted-foreground">
            Result for <strong className="text-foreground">{session.candidateInfo.fullName}</strong>
          </p>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconShieldCheck className="size-3.5 text-primary" />
            <span>Secured by ARGUS</span>
          </div>
          <Link href="/exam" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Return to exam finder
          </Link>
        </div>
      </div>
    </PublicExamLayout>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: "emerald" | "red" | "muted" }) {
  const cls = color === "emerald"
    ? "text-emerald-600 dark:text-emerald-400"
    : color === "red"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground"
  return (
    <div className="flex flex-col items-center rounded-xl border bg-white px-3 py-3 dark:bg-card">
      <span className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
