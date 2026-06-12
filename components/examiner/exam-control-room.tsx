"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconCopy,
  IconDownload,
  IconEdit,
  IconEye,
  IconLink,
  IconRefresh,
  IconRocket,
  IconSettings,
  IconShield,
  IconShare,
  IconTrash,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { toast } from "sonner"

import { entityId } from "@/components/workspace/page-elements"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiRequestError, apiRequest, downloadApiFile, getSession, serverUrl } from "@/lib/api/client"
import type { AntiCheatLog, Attempt, Exam, ExamInvite, Question } from "@/lib/api/types"

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ResultRow = {
  candidate: string; email: string; score: number; totalMarks: number
  percentage: number; passed: boolean; status: string; submittedAt: string
}

// â”€â”€â”€ Tab config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TabId = "overview" | "questions" | "candidates" | "attempts" | "results" | "anticheat" | "share" | "settings"

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "overview",    label: "Overview",    icon: <IconEye className="size-4" /> },
  { id: "questions",   label: "Questions",   icon: <IconClipboardList className="size-4" /> },
  { id: "candidates",  label: "Candidates",  icon: <IconUsers className="size-4" /> },
  { id: "attempts",    label: "Attempts",    icon: <IconClock className="size-4" /> },
  { id: "results",     label: "Results",     icon: <IconCheck className="size-4" /> },
  { id: "anticheat",   label: "Anti-Cheat",  icon: <IconShield className="size-4" /> },
  { id: "share",       label: "Share",       icon: <IconShare className="size-4" /> },
  { id: "settings",    label: "Settings",    icon: <IconSettings className="size-4" /> },
]

// â”€â”€â”€ Status helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(d?: string) {
  if (!d) return "â€”"
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getPublishIssues(exam: Exam) {
  const issues: string[] = []
  if (!exam.title?.trim()) issues.push("Exam title")
  if (!exam.instructions?.trim()) issues.push("Instructions")
  if (!Array.isArray(exam.questions) || exam.questions.length === 0) issues.push("Questions")
  if (exam.passMark == null) issues.push("Pass mark")
  if (!exam.antiCheatSettings) issues.push("Anti-cheat settings")
  return issues
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800",
  PUBLISHED:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
  SCHEDULED:  "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40",
  ACTIVE:     "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
  CLOSED:     "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
  DISABLED:   "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40",
  ARCHIVED:   "bg-muted/60 text-muted-foreground border-border",
}

// â”€â”€â”€ ExamControlRoom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ExamControlRoom() {
  const { examId } = useParams<{ examId: string }>()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [confirmAction, setConfirmAction] = useState<"publish" | "unpublish" | "close" | "archive" | "delete" | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [regenConfirm, setRegenConfirm] = useState(false)

  const exam = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => apiRequest<Exam>(`/exams/${examId}`).then((r) => r.data),
  })
  const attempts = useQuery({
    queryKey: ["exam", examId, "attempts"],
    queryFn: () => apiRequest<Attempt[]>(`/exams/${examId}/attempts?limit=100`).then((r) => r.data),
    enabled: activeTab === "attempts" || activeTab === "overview",
  })
  const results = useQuery({
    queryKey: ["exam", examId, "results"],
    queryFn: () => apiRequest<ResultRow[]>(`/reports/exams/${examId}/results?limit=100`).then((r) => r.data),
    enabled: activeTab === "results",
  })
  const logs = useQuery({
    queryKey: ["exam", examId, "anti-cheat"],
    queryFn: () => apiRequest<AntiCheatLog[]>(`/exams/${examId}/anti-cheat/reports?limit=100`).then((r) => r.data),
    enabled: activeTab === "anticheat",
  })
  const invites = useQuery({
    queryKey: ["exam", examId, "invites"],
    queryFn: () => apiRequest<ExamInvite[]>(`/exams/${examId}/invites`).then((r) => r.data),
    enabled: activeTab === "candidates" && exam.data?.accessType !== "PUBLIC_LINK_WITH_CODE",
  })

  // Live socket for monitoring
  useEffect(() => {
    const token = getSession()?.accessToken
    if (!token || !examId) return
    const socket = io(serverUrl, { auth: { token } })
    socket.emit("examiner:join-monitoring", { examId })
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "anti-cheat"] })
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "results"] })
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "attempts"] })
    }
    socket.on("exam:anti-cheat-warning", refresh)
    socket.on("exam:anti-cheat-critical", refresh)
    socket.on("exam:candidate-submitted", refresh)
    socket.on("exam:candidate-auto-submitted", refresh)
    return () => { socket.disconnect() }
  }, [examId, queryClient])

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      status === "PUBLISHED"
        ? apiRequest(`/exams/${examId}/publish`, { method: "POST" })
        : status === "DRAFT"
          ? apiRequest(`/exams/${examId}/unpublish`, { method: "POST" })
        : status === "CLOSED"
          ? apiRequest(`/exams/${examId}/close`, { method: "POST" })
          : status === "ARCHIVED"
            ? apiRequest(`/exams/${examId}/archive`, { method: "POST" })
            : apiRequest(`/exams/${examId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, status) => {
      const labels: Record<string, string> = { PUBLISHED: "Exam published.", DRAFT: "Exam unpublished.", CLOSED: "Exam closed.", ARCHIVED: "Exam archived." }
      toast.success(labels[status] ?? "Updated.")
      setConfirmAction(null)
      queryClient.invalidateQueries({ queryKey: ["exam", examId] })
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/exams/${examId}/permanent`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Exam deleted."); window.location.assign("/examiner/exams") },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const regenMutation = useMutation({
    mutationFn: () => apiRequest(`/exams/${examId}/regenerate-access-code`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Access code regenerated.")
      setRegenConfirm(false)
      queryClient.invalidateQueries({ queryKey: ["exam", examId] })
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const e = exam.data
  const qCount = Array.isArray(e?.questions) ? e.questions.length : 0
  const inProgress = (attempts.data ?? []).filter((a) => a.status === "IN_PROGRESS").length
  const submitted = (attempts.data ?? []).filter((a) => ["SUBMITTED", "AUTO_SUBMITTED"].includes(a.status)).length
  const flagged = (attempts.data ?? []).filter((a) => a.status === "FLAGGED").length

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="mx-auto max-w-6xl">
          <Link href="/examiner/exams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <IconArrowLeft className="size-4" />
            Back to Exams
          </Link>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {exam.isPending ? (
                <div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-48" /></div>
              ) : e ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold">{e.title}</h1>
                    {e.code && <span className="font-mono text-sm text-muted-foreground">{e.code}</span>}
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}>
                      {e.status}
                    </span>
                  </div>
                  {e.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{e.description}</p>}
                </>
              ) : null}
            </div>
            {e && (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}><IconShare className="size-4" />Share</Button>
                {e.status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const issues = getPublishIssues(e)
                      if (issues.length > 0) {
                        toast.error(`${issues.join(", ")} ${issues.length > 1 ? "are" : "is"} required before publishing.`)
                        return
                      }
                      setConfirmAction("publish")
                    }}
                  ><IconRocket className="size-4" />Publish</Button>
                )}
                {(e.status === "PUBLISHED" || e.status === "SCHEDULED") && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction("unpublish")}><IconArrowLeft className="size-4" />Unpublish</Button>
                )}
                {(e.status === "PUBLISHED" || e.status === "ACTIVE") && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction("close")}><IconCheck className="size-4" />Close</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-muted/10 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {exam.isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !e ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Exam not found.</div>
          ) : (
            <>
              {activeTab === "overview" && <TabOverview exam={e} attempts={attempts.data ?? []} inProgress={inProgress} submitted={submitted} flagged={flagged} qCount={qCount} />}
              {activeTab === "questions" && <TabQuestions exam={e} />}
              {activeTab === "candidates" && <TabCandidates exam={e} invites={invites.data ?? []} isLoading={invites.isPending} examId={examId} />}
              {activeTab === "attempts" && <TabAttempts attempts={attempts.data ?? []} isLoading={attempts.isPending} examId={examId} />}
              {activeTab === "results" && <TabResults results={results.data ?? []} isLoading={results.isPending} examId={examId} />}
              {activeTab === "anticheat" && <TabAntiCheat logs={logs.data ?? []} isLoading={logs.isPending} />}
              {activeTab === "share" && <TabShare exam={e} onRegen={() => setRegenConfirm(true)} />}
              {activeTab === "settings" && <TabSettings exam={e} examId={examId} onArchived={() => setConfirmAction("archive")} onDeleted={() => setConfirmAction("delete")} />}
            </>
          )}
        </div>
      </div>

      {/* Confirm action dialogs */}
      {confirmAction && confirmAction !== "delete" && (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === "publish" ? "Publish this exam?" : confirmAction === "unpublish" ? "Unpublish this exam?" : confirmAction === "close" ? "Close this exam?" : "Archive this exam?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "publish" && "Candidates will be able to access and attempt this exam."}
                {confirmAction === "unpublish" && "The exam will return to draft and stop being available until you publish it again."}
                {confirmAction === "close" && "No new attempts will be accepted. In-progress candidates will be auto-submitted."}
                {confirmAction === "archive" && "The exam will be hidden from your active list."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={statusMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={statusMutation.isPending}
                onClick={(ev) => {
                  ev.preventDefault()
                  const s = { publish: "PUBLISHED", unpublish: "DRAFT", close: "CLOSED", archive: "ARCHIVED" }[confirmAction]!
                  statusMutation.mutate(s)
                }}
              >
                {statusMutation.isPending ? "Please waitâ€¦" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {confirmAction === "delete" && (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove the exam and all attempts and results. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleteMutation.isPending} onClick={(ev) => { ev.preventDefault(); deleteMutation.mutate() }}>
                {deleteMutation.isPending ? "Deletingâ€¦" : "Delete exam"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Regenerate code confirm */}
      <AlertDialog open={regenConfirm} onOpenChange={(open) => !open && setRegenConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate access code?</AlertDialogTitle>
            <AlertDialogDescription>The old access code will stop working immediately. Share the new code with candidates.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={regenMutation.isPending} onClick={(ev) => { ev.preventDefault(); regenMutation.mutate() }}>
              {regenMutation.isPending ? "Regeneratingâ€¦" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share modal */}
      {shareOpen && e && <ShareModal exam={e} onClose={() => setShareOpen(false)} onRegen={() => { setShareOpen(false); setRegenConfirm(true) }} />}
    </div>
  )
}

// â”€â”€â”€ Tab: Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabOverview({ exam, attempts, inProgress, submitted, flagged, qCount }: {
  exam: Exam; attempts: Attempt[]; inProgress: number; submitted: number; flagged: number; qCount: number
}) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Questions" value={qCount} icon={<IconClipboardList className="size-5" />} />
        <StatCard label="In Progress" value={inProgress} icon={<IconClock className="size-5" />} accent={inProgress > 0 ? "blue" : undefined} />
        <StatCard label="Submitted" value={submitted} icon={<IconCheck className="size-5" />} accent={submitted > 0 ? "emerald" : undefined} />
        <StatCard label="Flagged" value={flagged} icon={<IconAlertTriangle className="size-5" />} accent={flagged > 0 ? "red" : undefined} />
      </div>

      {/* Exam info card */}
      <div className="rounded-xl border bg-card">
        <div className="border-b bg-muted/30 px-5 py-3.5">
          <p className="text-sm font-semibold">Exam Details</p>
        </div>
        <div className="divide-y">
          <InfoRow label="Duration" value={fmtDuration(exam.durationMinutes)} />
          <InfoRow label="Access type" value={exam.accessType?.replace(/_/g, " ") ?? "â€”"} />
          <InfoRow label="Availability" value={exam.availabilityMode?.replace(/_/g, " ") ?? "â€”"} />
          {exam.startTime && <InfoRow label="Start time" value={fmtDate(exam.startTime)} />}
          {exam.endTime && <InfoRow label="End time" value={fmtDate(exam.endTime)} />}
          {exam.totalMarks != null && <InfoRow label="Total marks" value={String(exam.totalMarks)} />}
          {exam.passMark != null && <InfoRow label="Pass mark" value={String(exam.passMark)} />}
          <InfoRow label="Randomize questions" value={exam.randomizeQuestions ? "Yes" : "No"} />
          <InfoRow label="Show result immediately" value={exam.showResultImmediately ? "Yes" : "No"} />
        </div>
      </div>

      {/* Recent attempts */}
      {attempts.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b bg-muted/30 px-5 py-3.5">
            <p className="text-sm font-semibold">Recent Attempts</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.slice(0, 5).map((a) => (
                <TableRow key={entityId(a)}>
                  <TableCell className="font-medium">{a.candidateProfile?.fullName ?? a.candidate?.fullName ?? "Anonymous"}</TableCell>
                  <TableCell><AttemptStatusBadge status={a.status} /></TableCell>
                  <TableCell>{a.score != null ? `${a.score} / ${a.totalMarks ?? "?"}` : "â€”"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{fmtDate(a.expiresAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Questions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabQuestions({ exam }: { exam: Exam }) {
  const questions = (exam.questions ?? []) as Question[]

  if (!questions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
        <IconClipboardList className="size-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">No questions attached</p>
        <p className="mt-1 text-sm text-muted-foreground">Edit this exam to add questions from a question bank.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        typeof q === "string" ? (
          <div key={q} className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Question ID: {q}</div>
        ) : (
          <div key={entityId(q)} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-muted-foreground mt-0.5">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{q.questionText}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{q.questionType?.replace(/_/g, " ")} Â· {q.marks} pt{q.marks === 1 ? "" : "s"}</p>
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  )
}

// â”€â”€â”€ Tab: Candidates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabCandidates({ exam, invites, isLoading, examId }: {
  exam: Exam; invites: ExamInvite[]; isLoading: boolean; examId: string
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")

  const inviteMutation = useMutation({
    mutationFn: (emails: string[]) =>
      apiRequest(`/exams/${examId}/invites`, { method: "POST", body: JSON.stringify({ candidates: emails.map((e) => ({ email: e })) }) }),
    onSuccess: () => {
      toast.success("Invite sent.")
      setEmail("")
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "invites"] })
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/exams/${examId}/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Invite revoked.")
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "invites"] })
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  if (exam.accessType === "PUBLIC_LINK_WITH_CODE") {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        <IconWorld className="mx-auto mb-2 size-8 opacity-30" />
        This exam uses public access. Any candidate with the link and code can participate â€” no invite management needed.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Add invite */}
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-3 text-sm font-semibold">Invite candidate</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email.trim() && inviteMutation.mutate([email.trim()])}
            placeholder="candidate@email.com"
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
          />
          <Button size="sm" disabled={!email.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate([email.trim()])}>
            Send invite
          </Button>
        </div>
      </div>

      {/* Invite list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-3.5 flex items-center justify-between">
          <p className="text-sm font-semibold">Invited candidates ({invites.length})</p>
          {invites.length > 0 && (
            <button
              type="button"
              onClick={() => downloadApiFile(`/exams/${examId}/invites/export`, `invites-${examId}.csv`).catch((err) => toast.error((err as Error).message))}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconDownload className="size-3.5" />Export CSV
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : invites.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No candidates invited yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={entityId(inv)}>
                  <TableCell className="font-medium">{inv.email}</TableCell>
                  <TableCell><InviteStatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.createdAt)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => revokeMutation.mutate(entityId(inv))}
                      className="text-muted-foreground hover:text-destructive"
                      title="Revoke invite"
                    >
                      <IconX className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Attempts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabAttempts({ attempts, isLoading, examId }: { attempts: Attempt[]; isLoading: boolean; examId: string }) {
  const queryClient = useQueryClient()
  const grantRetake = useMutation({
    mutationFn: (attemptId: string) => apiRequest(`/attempts/${attemptId}/grant-retake`, { method: "POST", body: JSON.stringify({ reason: "Retake approved after examiner review." }) }),
    onSuccess: () => { toast.success("Retake granted. The candidate may start a fresh attempt."); queryClient.invalidateQueries({ queryKey: ["exam", examId, "attempts"] }) },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/30 px-5 py-3.5 flex items-center justify-between">
        <p className="text-sm font-semibold">Attempts ({attempts.length})</p>
        {attempts.length > 0 && (
          <button
            type="button"
            onClick={() => downloadApiFile(`/reports/exams/${examId}/attempts/export`, `attempts-${examId}.csv`).catch((err) => toast.error((err as Error).message))}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconDownload className="size-3.5" />Export CSV
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : attempts.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No attempts recorded yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Violation score</TableHead>
              <TableHead>Expires</TableHead><TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((a) => (
              <TableRow key={entityId(a)}>
                <TableCell className="font-medium">{a.candidateProfile?.fullName ?? a.candidate?.fullName ?? "Anonymous"}<br /><span className="text-xs text-muted-foreground">{a.candidateProfile?.email ?? a.candidate?.email ?? ""}</span></TableCell>
                <TableCell><AttemptStatusBadge status={a.status} /></TableCell>
                <TableCell>{a.score != null ? `${a.score} / ${a.totalMarks ?? "?"}` : "â€”"}{a.percentage != null ? <span className="ml-1 text-xs text-muted-foreground">({a.percentage}%)</span> : null}</TableCell>
                <TableCell>{a.violationScore != null ? <span className={a.violationScore > 50 ? "text-destructive font-medium" : ""}>{a.violationScore}</span> : "â€”"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(a.expiresAt)}</TableCell><TableCell>{a.status === "AUTO_SUBMITTED" ? <Button size="sm" variant="outline" disabled={Boolean(a.retakeGrantedAt) || grantRetake.isPending} onClick={() => grantRetake.mutate(entityId(a))}>{a.retakeGrantedAt ? "Retake granted" : "Grant retake"}</Button> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabResults({ results, isLoading, examId }: { results: ResultRow[]; isLoading: boolean; examId: string }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/30 px-5 py-3.5 flex items-center justify-between">
        <p className="text-sm font-semibold">Results ({results.length})</p>
        {results.length > 0 && (
          <button
            type="button"
            onClick={() => downloadApiFile(`/reports/exams/${examId}/results/export`, `results-${examId}.csv`).catch((err) => toast.error((err as Error).message))}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconDownload className="size-3.5" />Export CSV
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : results.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No results yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Passed</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.candidate}<br /><span className="text-xs text-muted-foreground">{r.email}</span></TableCell>
                <TableCell>{r.score} / {r.totalMarks}</TableCell>
                <TableCell>{r.percentage}%</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.passed ? "text-emerald-600" : "text-destructive"}`}>
                    {r.passed ? <IconCheck className="size-3.5" /> : <IconX className="size-3.5" />}
                    {r.passed ? "Pass" : "Fail"}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(r.submittedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Anti-Cheat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabAntiCheat({ logs, isLoading }: { logs: AntiCheatLog[]; isLoading: boolean }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/30 px-5 py-3.5">
        <p className="text-sm font-semibold">Anti-cheat events ({logs.length})</p>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No anti-cheat events recorded.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={entityId(log)}>
                <TableCell className="font-medium">{log.eventType}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                    log.severity === "CRITICAL" ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                    log.severity === "WARNING" ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                    "border-muted bg-muted/40 text-muted-foreground"
                  }`}>{log.severity}</span>
                </TableCell>
                <TableCell>{log.points}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.systemAction}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Share â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabShare({ exam, onRegen }: { exam: Exam; onRegen: () => void }) {
  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard.`)
  }

  return (
    <div className="space-y-4">
      {exam.publicUrl && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Public exam link</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2.5 font-mono text-xs text-foreground break-all">{exam.publicUrl}</div>
            <Button variant="outline" size="sm" onClick={() => copy(exam.publicUrl!, "Link")}><IconCopy className="size-4" />Copy</Button>
          </div>
        </div>
      )}
      {exam.code && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Access code</p>
            <button
              type="button"
              onClick={onRegen}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconRefresh className="size-3.5" />Regenerate
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex size-14 items-center justify-center rounded-xl border-2 bg-primary/5 font-mono text-xl font-bold text-primary tracking-wider">
              {exam.code}
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(exam.code!, "Access code")}><IconCopy className="size-4" />Copy code</Button>
          </div>
          {exam.accessCodeLastGeneratedAt && (
            <p className="text-xs text-muted-foreground">Last regenerated: {fmtDate(exam.accessCodeLastGeneratedAt)}</p>
          )}
        </div>
      )}
      {!exam.publicUrl && !exam.code && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-12 text-center">
          <IconLink className="mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No share link available. Publish the exam to generate a link.</p>
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabSettings({ exam, examId, onArchived, onDeleted }: { exam: Exam; examId: string; onArchived: () => void; onDeleted: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card divide-y">
        <InfoRow label="Exam ID" value={examId} mono />
        <InfoRow label="Created" value={fmtDate(exam.createdAt)} />
        <InfoRow label="Updated" value={fmtDate(exam.updatedAt)} />
        <InfoRow label="Max attempts" value={String(exam.maxAttempts ?? 1)} />
        <InfoRow label="Access type" value={exam.accessType?.replace(/_/g, " ") ?? "â€”"} />
      </div>
      <div className="rounded-xl border border-destructive/30 bg-card p-5">
        <p className="text-sm font-semibold text-destructive">Danger zone</p>
        <p className="mt-1 text-xs text-muted-foreground">These actions are irreversible. Proceed with caution.</p>
        <div className="mt-4 flex gap-2">
          <Link href={`/examiner/exams/${examId}/edit`}>
            <Button variant="outline" size="sm"><IconEdit className="size-4" />Edit exam</Button>
          </Link>
          {(exam.status === "CLOSED" || exam.status === "DRAFT") && (
            <Button variant="outline" size="sm" onClick={onArchived}><IconArchive className="size-4" />Archive</Button>
          )}
          <Button variant="destructive" size="sm" onClick={onDeleted}><IconTrash className="size-4" />Delete exam</Button>
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ Share Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ShareModal({ exam, onClose, onRegen }: { exam: Exam; onClose: () => void; onRegen: () => void }) {
  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <p className="font-semibold">Share Exam</p>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><IconX className="size-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          {exam.publicUrl && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exam link</p>
              <div className="flex gap-2">
                <div className="flex-1 truncate rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono">{exam.publicUrl}</div>
                <Button variant="outline" size="sm" onClick={() => copy(exam.publicUrl!, "Link")}><IconCopy className="size-4" /></Button>
              </div>
            </div>
          )}
          {exam.code && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access code</p>
              <div className="flex items-center gap-3">
                <div className="flex h-12 items-center justify-center rounded-lg border-2 bg-primary/5 px-4 font-mono text-2xl font-bold tracking-widest text-primary">
                  {exam.code}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => copy(exam.code!, "Access code")}><IconCopy className="size-4" /></Button>
                  <Button variant="outline" size="sm" onClick={onRegen}><IconRefresh className="size-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ Small helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "blue" | "emerald" | "red" }) {
  const accentClass = (accent ? {
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-destructive",
  }[accent] : undefined) ?? "text-foreground"

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-muted-foreground/40">{icon}</div>
      </div>
      <p className={`mt-2 text-3xl font-bold ${accentClass}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}

function AttemptStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
    SUBMITTED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
    AUTO_SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
    FLAGGED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
    CANCELLED: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400",
    EXPIRED: "bg-orange-50 text-orange-700 border-orange-200",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted/40 text-muted-foreground border-border"}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

function InviteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
    VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    STARTED: "bg-violet-50 text-violet-700 border-violet-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REVOKED: "bg-red-50 text-red-700 border-red-200",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted/40 text-muted-foreground border-border"}`}>
      {status}
    </span>
  )
}

