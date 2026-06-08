"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconClock,
  IconClockOff,
  IconFileText,
  IconLock,
  IconRefresh,
  IconShield,
  IconShieldCheck,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"

import { ExamPageShell, PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/lib/api/client"

// The shape returned by GET /public/exams/:examCode
export type PublicExamInfo = {
  code?: string
  slug?: string
  title: string
  description?: string
  instructions?: string
  durationMinutes: number
  questionCount: number
  totalMarks?: number
  passMark?: number
  canStart: boolean
  status: string
  accessType?: string
  availabilityMode?: string
  startTime?: string
  endTime?: string
  candidateIdentityRequirements: {
    fullName: boolean
    email: boolean
    phone: boolean
    identifier: boolean
    customFields?: Array<{ key: string; label: string; type: "text" | "email" | "tel" | "number"; placeholder?: string; required?: boolean }>
  }
  antiCheatSummary: {
    requiresFullscreen: boolean
    detectsTabSwitching: boolean
    blocksCopyPaste: boolean
    webcamRequired: boolean
    autoSubmitEnabled: boolean
    disablesRightClick?: boolean
  }
  accessCodeRequired?: boolean
  emailVerificationRequired?: boolean
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} minutes`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h} hour${h > 1 ? "s" : ""}`
}

export function ExamLanding({ examCode }: { examCode: string }) {
  const router = useRouter()
  const code = examCode.toUpperCase()

  const examQuery = useQuery({
    queryKey: ["public-exam", code],
    queryFn: () => apiRequest<PublicExamInfo>(`/public/exams/${code}`, {}, { authenticated: false }).then((r) => r.data),
    retry: 1,
  })

  // ── Loading ──
  if (examQuery.isPending) {
    return (
      <PublicExamLayout step="landing">
        <ExamPageShell>
          <LoadingExamState />
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  // ── Not found ──
  if (examQuery.isError) {
    return (
      <PublicExamLayout step="landing">
        <ExamPageShell>
          <ExamNotFoundState examCode={code} />
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  const exam = examQuery.data

  // ── Closed ──
  if (exam.status === "CLOSED" || exam.status === "ARCHIVED" || exam.status === "CANCELLED") {
    return (
      <PublicExamLayout step="landing">
        <ExamPageShell>
          <ExamClosedState exam={exam} />
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  // ── Not yet open ──
  const notYetOpen =
    exam.availabilityMode === "SCHEDULED" && exam.startTime && new Date(exam.startTime) > new Date()

  return (
    <PublicExamLayout step="landing">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 space-y-5">
        {/* Exam code chip */}
        {exam.code && (
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold tracking-widest text-primary uppercase">
            {exam.code}
          </div>
        )}

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{exam.title}</h1>
          {exam.description && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{exam.description}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip icon={<IconClock className="size-4" />} label="Duration" value={fmtDuration(exam.durationMinutes)} />
          <StatChip icon={<IconFileText className="size-4" />} label="Questions" value={`${exam.questionCount}`} />
          {exam.totalMarks != null && <StatChip icon={<IconShield className="size-4" />} label="Total marks" value={`${exam.totalMarks}`} />}
          <StatChip
            icon={exam.accessType === "INVITE_ONLY" ? <IconUsers className="size-4" /> : exam.accessType === "LOGIN_REQUIRED_WITH_CODE" ? <IconLock className="size-4" /> : <IconWorld className="size-4" />}
            label="Access"
            value={exam.accessType === "INVITE_ONLY" ? "Invite only" : exam.accessType === "LOGIN_REQUIRED_WITH_CODE" ? "Email verified" : "Public exam"}
          />
        </div>

        {/* Scheduled window */}
        {exam.availabilityMode === "SCHEDULED" && (exam.startTime || exam.endTime) && (
          <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/20">
            <IconCalendar className="mt-0.5 size-4.5 shrink-0 text-violet-600" />
            <div className="text-sm text-violet-800 dark:text-violet-300">
              {exam.startTime && <span>Opens: <strong>{fmtDate(exam.startTime)}</strong></span>}
              {exam.startTime && exam.endTime && " · "}
              {exam.endTime && <span>Closes: <strong>{fmtDate(exam.endTime)}</strong></span>}
            </div>
          </div>
        )}

        {/* Not yet open banner */}
        {notYetOpen && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <IconClockOff className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This exam is not open yet</p>
              {exam.startTime && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">Start time: {fmtDate(exam.startTime)}</p>}
            </div>
          </div>
        )}

        {/* Instructions */}
        {exam.instructions && (
          <div className="rounded-xl border bg-white px-5 py-4 dark:bg-card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instructions</p>
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">{exam.instructions}</p>
          </div>
        )}

        {/* Anti-cheat summary */}
        <div className="rounded-xl border bg-white px-5 py-4 dark:bg-card">
          <div className="mb-3 flex items-center gap-2">
            <IconShieldCheck className="size-4.5 text-primary" />
            <p className="text-sm font-semibold">Anti-cheat monitoring is active</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exam.antiCheatSummary.requiresFullscreen && <AcChip label="Fullscreen required" />}
            {exam.antiCheatSummary.detectsTabSwitching && <AcChip label="Tab switching detected" />}
            {exam.antiCheatSummary.blocksCopyPaste && <AcChip label="Copy/paste blocked" />}
            {exam.antiCheatSummary.disablesRightClick && <AcChip label="Right-click disabled" />}
            {exam.antiCheatSummary.webcamRequired && <AcChip label="Webcam required" />}
            {exam.antiCheatSummary.autoSubmitEnabled && <AcChip label="Auto-submit on violations" />}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            All activity is recorded. Suspicious behaviour may result in automatic submission.
          </p>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full"
          disabled={!exam.canStart || !!notYetOpen}
          onClick={() => router.push(`/exam/${code.toLowerCase()}/verify`)}
        >
          {notYetOpen ? "Exam Not Open Yet" : "Verify Access Code"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          You will verify your access code on the next step.
        </p>
      </div>
    </PublicExamLayout>
  )
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-white px-4 py-3 dark:bg-card">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[11px] font-medium uppercase tracking-wider">{label}</span></div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function AcChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      <IconCheck className="size-3" />{label}
    </span>
  )
}

export function LoadingExamState() {
  return (
    <div className="space-y-4 py-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`h-${i === 0 ? 8 : 14} animate-pulse rounded-xl bg-muted/60`} />
      ))}
      <p className="text-center text-sm text-muted-foreground">Loading exam details…</p>
    </div>
  )
}

export function ExamNotFoundState({ examCode }: { examCode?: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <IconAlertCircle className="size-8 text-destructive" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Exam not found</h2>
      {examCode && <p className="mt-1 font-mono text-sm text-muted-foreground">Code: {examCode}</p>}
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        This exam code does not exist or the exam has been removed. Please check your code and try again.
      </p>
      <Link href="/exam" className="mt-6">
        <Button variant="outline">Try a different code</Button>
      </Link>
    </div>
  )
}

export function ExamClosedState({ exam }: { exam: PublicExamInfo }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <IconClockOff className="size-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{exam.title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This exam is no longer available. Please contact your examiner if you believe this is an error.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        Status: {exam.status}
      </div>
      <Link href="/exam" className="mt-6">
        <Button variant="outline">Return to exam finder</Button>
      </Link>
    </div>
  )
}
