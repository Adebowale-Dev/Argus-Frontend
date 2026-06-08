"use client"

import Link from "next/link"
import { useCallback, useId, useMemo, useRef, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFilter,
  IconGridDots,
  IconList,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { StatusBadge, entityId } from "@/components/workspace/page-elements"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError, apiRequest, downloadApiFile } from "@/lib/api/client"
import type { Question, QuestionBank as QuestionBankType } from "@/lib/api/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type QType = "SINGLE_SELECT" | "MULTIPLE_CHOICE" | "TRUE_FALSE"
type OptionRow = { key: string; text: string; explanation: string }
type ImportPreviewRow = {
  row: number
  questionText: string
  questionType: string
  marks: number
  topic?: string
  optionCount: number
  correctAnswer: string[]
  tags: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SELECT: "Single Choice",
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "True / False",
}

const TYPE_COLORS: Record<string, string> = {
  SINGLE_SELECT:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
  MULTIPLE_CHOICE:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40",
  TRUE_FALSE:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
}

const OPTION_POOL = ["A", "B", "C", "D", "E", "F"]
const nextKey = (used: string[]) => OPTION_POOL.find((k) => !used.includes(k)) ?? null

// ─── Utilities ────────────────────────────────────────────────────────────────

function qbId(value: Question["questionBank"]) {
  if (!value) return ""
  if (typeof value === "string") return value
  return entityId(value)
}

function issueMessages(issue: Record<string, unknown>) {
  const list = Array.isArray(issue.issues) ? (issue.issues as Array<Record<string, unknown>>) : []
  return list.map((e) => {
    const path = Array.isArray(e.path) ? e.path.join(".") : "row"
    const msg = typeof e.message === "string" ? e.message : "Invalid value"
    return `${path}: ${msg}`
  }).filter(Boolean)
}

function buildQuestionPayload(
  questionType: QType,
  questionText: string,
  options: OptionRow[],
  correctKeys: string[],
  marks: number,
  explanation: string,
  questionBank: string,
) {
  if (questionType === "TRUE_FALSE") {
    return {
      questionBank,
      questionText,
      questionType,
      options: [{ key: "A", text: "True" }, { key: "B", text: "False" }],
      correctAnswer: correctKeys.slice(0, 1),
      marks,
      explanation: explanation.trim() || undefined,
    }
  }
  return {
    questionBank,
    questionText,
    questionType,
    options: options.filter((o) => o.text.trim()).map((o) => ({ key: o.key, text: o.text })),
    correctAnswer: correctKeys,
    marks,
    explanation: explanation.trim() || undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QuestionBankOverview
// ═══════════════════════════════════════════════════════════════════════════════

export function QuestionBankOverview() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => apiRequest<QuestionBankType[]>("/question-banks?limit=100").then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiRequest<QuestionBankType>("/question-banks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (res) => {
      toast.success("Question bank created.")
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ["question-banks"] })
      window.location.assign(`/examiner/questions/${entityId(res.data)}`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createMutation.mutate({
      title: String(fd.get("title")).trim(),
      description: String(fd.get("description") ?? "").trim() || undefined,
      tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    })
  }

  const filtered = useMemo(() => {
    return (banks.data ?? []).filter((b) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.tags?.some((t) => t.toLowerCase().includes(q))
      return matchSearch && (statusFilter === "ALL" || b.status === statusFilter)
    })
  }, [banks.data, search, statusFilter])

  const total = banks.data?.length ?? 0
  const totalQ = banks.data?.reduce((s, b) => s + (b.questionCount ?? 0), 0) ?? 0

  return (
    <div className="flex min-h-full flex-col">
      {/* Hero */}
      <div className="border-b bg-card px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <IconBook className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Question Banks</h1>
              </div>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Create reusable question collections and attach them to any exam.
              </p>
              {banks.data && (
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span>
                    <span className="font-semibold text-foreground">{total}</span>
                    <span className="ml-1 text-muted-foreground">bank{total === 1 ? "" : "s"}</span>
                  </span>
                  <span className="text-border">·</span>
                  <span>
                    <span className="font-semibold text-foreground">{totalQ}</span>
                    <span className="ml-1 text-muted-foreground">total questions</span>
                  </span>
                </div>
              )}
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
              <IconPlus className="size-4" />
              New bank
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="relative min-w-45 flex-1 max-w-sm">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search banks…" className="pl-9 pr-8" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <IconX className="size-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-md border p-1">
            {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-md border p-1">
            <button type="button" onClick={() => setViewMode("grid")} className={`rounded p-1 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <IconGridDots className="size-4" />
            </button>
            <button type="button" onClick={() => setViewMode("list")} className={`rounded p-1 transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <IconList className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {!banks.data ? (
            <div className={`grid gap-4 ${viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" /></div>
                  </div>
                  <div className="mt-4 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>
                </div>
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <IconBook className="size-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-base font-medium">{search || statusFilter !== "ALL" ? "No banks match" : "No question banks yet"}</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {search || statusFilter !== "ALL" ? "Try a different search term or filter." : "Create your first question bank to start building question collections for your exams."}
              </p>
              {!search && statusFilter === "ALL" && (
                <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
                  <IconPlus className="size-4" /> Create Question Bank
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((bank) => <BankCard key={entityId(bank)} bank={bank} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((bank) => <BankListRow key={entityId(bank)} bank={bank} />)}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New question bank</DialogTitle>
            <DialogDescription>Give this bank a clear title so you can find and reuse it easily.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <FieldGroup>
              <Field>
                <FieldLabel>Title <span className="text-destructive">*</span></FieldLabel>
                <Input name="title" placeholder="e.g. Frontend Developer Screening" required autoFocus />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea name="description" placeholder="What is this bank for?" rows={3} />
              </Field>
              <Field>
                <FieldLabel>Tags <span className="text-xs font-normal text-muted-foreground">(comma separated)</span></FieldLabel>
                <Input name="tags" placeholder="javascript, react, hiring" />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create bank"}</Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BankCard({ bank }: { bank: QuestionBankType }) {
  const count = bank.questionCount ?? 0
  return (
    <Link href={`/examiner/questions/${entityId(bank)}`} className="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 transition-colors group-hover:border-primary/20 group-hover:bg-primary/10">
          <IconBook className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <StatusBadge status={bank.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug transition-colors group-hover:text-primary">{bank.title}</p>
        {bank.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{bank.description}</p>}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{count} question{count === 1 ? "" : "s"}</span>
        {bank.updatedAt && <span className="text-xs text-muted-foreground">Updated {new Date(bank.updatedAt).toLocaleDateString()}</span>}
      </div>
      {(bank.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bank.tags!.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              <IconTag className="size-3" />{tag}
            </span>
          ))}
          {(bank.tags?.length ?? 0) > 4 && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">+{bank.tags!.length - 4}</span>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open bank <IconArrowRight className="size-3.5" />
      </div>
    </Link>
  )
}

function BankListRow({ bank }: { bank: QuestionBankType }) {
  const count = bank.questionCount ?? 0
  return (
    <Link href={`/examiner/questions/${entityId(bank)}`} className="group flex items-center gap-4 rounded-lg border bg-card px-5 py-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 group-hover:bg-primary/10">
        <IconBook className="size-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium group-hover:text-primary">{bank.title}</p>
          <StatusBadge status={bank.status} />
        </div>
        {bank.description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{bank.description}</p>}
      </div>
      <div className="shrink-0 text-sm text-muted-foreground">{count} question{count === 1 ? "" : "s"}</div>
      <IconArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// QuestionBankWorkspace
// ═══════════════════════════════════════════════════════════════════════════════

// panel = which top-level panel is open (never "add" simultaneously with editingId)
type TopPanel = "none" | "add" | "csv" | "reuse"

export function QuestionBankWorkspace({ bankId }: { bankId: string }) {
  const queryClient = useQueryClient()

  // "add" = new question form shown at top, no editingId
  // editingId = inline form shown instead of that specific card, no "add" panel
  const [topPanel, setTopPanel] = useState<TopPanel>("none")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")

  // Bulk selection mode
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<ImportPreviewRow[]>([])
  const [csvIssues, setCsvIssues] = useState<Array<Record<string, unknown>>>([])

  // Reuse
  const [reuseSourceBankId, setReuseSourceBankId] = useState<string>("ALL")
  const [reuseSearch, setReuseSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const bank = useQuery({
    queryKey: ["question-bank", bankId],
    queryFn: () => apiRequest<QuestionBankType>(`/question-banks/${bankId}`).then((r) => r.data),
  })

  // All banks for the reuse bank-selector
  const allBanks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => apiRequest<QuestionBankType[]>("/question-banks?limit=100").then((r) => r.data),
    enabled: topPanel === "reuse",
  })

  // All questions from selected source bank (or all banks)
  const sourceQuestions = useQuery({
    queryKey: ["questions", "reuse-source", reuseSourceBankId],
    queryFn: () => {
      const url =
        reuseSourceBankId === "ALL"
          ? "/questions?limit=500"
          : `/question-banks/${reuseSourceBankId}/questions?limit=500`
      return apiRequest<Question[]>(url).then((r) => r.data)
    },
    enabled: topPanel === "reuse",
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["question-banks"] })
    queryClient.invalidateQueries({ queryKey: ["question-bank", bankId] })
    queryClient.invalidateQueries({ queryKey: ["question-bank", bankId, "questions"] })
  }, [queryClient, bankId])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Question removed."); setDeleteTarget(null); invalidate() },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append("file", file)
      return apiRequest<ImportPreviewRow[]>("/questions/bulk-import/preview", {
        method: "POST", body: fd, headers: { "X-Question-Bank": bankId },
      }).then((r) => r.data)
    },
    onSuccess: (rows, file) => { setCsvFile(file); setCsvPreview(rows); setCsvIssues([]); toast.success(`${rows.length} question${rows.length === 1 ? "" : "s"} ready to import.`) },
    onError: (e: ApiRequestError) => { setCsvFile(null); setCsvPreview([]); setCsvIssues(e.details ?? []); toast.error(e.message) },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append("file", file)
      return apiRequest("/questions/bulk-import", { method: "POST", body: fd, headers: { "X-Question-Bank": bankId } })
    },
    onSuccess: () => { toast.success("Questions imported."); setCsvFile(null); setCsvPreview([]); setCsvIssues([]); setTopPanel("none"); invalidate() },
    onError: (e: ApiRequestError) => { setCsvIssues(e.details ?? []); toast.error(e.message) },
  })

  const cloneMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest("/questions/clone", { method: "POST", body: JSON.stringify({ questionBank: bankId, sourceQuestionIds: ids }) }),
    onSuccess: () => { toast.success("Questions copied into this bank."); setSelectedIds([]); setTopPanel("none"); invalidate() },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => apiRequest(`/questions/${id}`, { method: "DELETE" }))),
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} question${ids.length === 1 ? "" : "s"} removed.`)
      setBulkSelected(new Set())
      setBulkMode(false)
      invalidate()
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  function toggleBulkMode() {
    setBulkMode((cur) => { if (cur) setBulkSelected(new Set()); return !cur })
    setEditingId(null)
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setBulkSelected(new Set(filteredQuestions.map(entityId)))
  }

  const bankQuestions = (bank.data?.questions ?? []).filter((q) => q.status !== "INACTIVE")
  const totalMarks = bankQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: bankQuestions.length }
    for (const q of bankQuestions) c[q.questionType] = (c[q.questionType] ?? 0) + 1
    return c
  }, [bankQuestions])

  const filteredQuestions = bankQuestions.filter((q) => {
    const lo = search.toLowerCase()
    const matchSearch = !search || q.questionText.toLowerCase().includes(lo) || (q.topic ?? "").toLowerCase().includes(lo)
    return matchSearch && (typeFilter === "ALL" || q.questionType === typeFilter)
  })

  // Candidates for reuse: from selected source bank, excluding questions already in this bank
  const existingTexts = useMemo(() => new Set(bankQuestions.map((q) => q.questionText.trim().toLowerCase())), [bankQuestions])

  const reuseCandidates = useMemo(() => {
    return (sourceQuestions.data ?? []).filter((q) => {
      if (qbId(q.questionBank) === bankId) return false // skip own questions
      if (existingTexts.has(q.questionText.trim().toLowerCase())) return false // skip duplicates
      if (!reuseSearch) return true
      const rl = reuseSearch.toLowerCase()
      return q.questionText.toLowerCase().includes(rl) || (q.topic ?? "").toLowerCase().includes(rl)
    })
  }, [sourceQuestions.data, bankId, reuseSearch, existingTexts])

  // ── Panel toggles (mutually exclusive) ──
  function openTopPanel(p: Exclude<TopPanel, "none">) {
    setEditingId(null) // always close inline edit when switching top panel
    setBulkMode(false)
    setBulkSelected(new Set())
    setTopPanel((cur) => (cur === p ? "none" : p))
  }

  function handleSaved() {
    setTopPanel("none")
    setEditingId(null)
    invalidate()
  }

  function handleEditInline(id: string) {
    setTopPanel("none") // close any top panel
    setEditingId((cur) => (cur === id ? null : id))
  }

  function cancelEdit() {
    setEditingId(null)
  }

  const selectedBank = bank.data

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b bg-card px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/examiner/questions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <IconArrowLeft className="size-4" />
            Back to Question Banks
          </Link>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {!selectedBank ? (
                <div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-96" /></div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold">{selectedBank.title}</h1>
                    <StatusBadge status={selectedBank.status} />
                  </div>
                  {selectedBank.description && <p className="mt-1 text-sm text-muted-foreground">{selectedBank.description}</p>}
                  {(selectedBank.tags ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedBank.tags!.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          <IconTag className="size-3" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {selectedBank && (
            <div className="mt-4 flex flex-wrap items-center gap-5 border-t pt-4 text-sm">
              <div><span className="font-semibold text-foreground">{bankQuestions.length}</span><span className="ml-1 text-muted-foreground">question{bankQuestions.length === 1 ? "" : "s"}</span></div>
              <div><span className="font-semibold text-foreground">{totalMarks}</span><span className="ml-1 text-muted-foreground">total marks</span></div>
              {Object.entries(typeCounts).filter(([k]) => k !== "ALL").map(([type, count]) => (
                <span key={type} className="text-muted-foreground">{count} {TYPE_LABELS[type] ?? type}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action cards */}
      <div className="border-b bg-muted/20 px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add questions</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ActionCard
              active={topPanel === "add"}
              icon={<IconPlus className="size-5" />}
              title="Create Manually"
              description="Build a question with the built-in question editor."
              action={
                <Button size="sm" disabled={!selectedBank} variant={topPanel === "add" ? "default" : "outline"} onClick={() => openTopPanel("add")}>
                  {topPanel === "add" ? "Close editor" : "Create question"}
                </Button>
              }
            />
            <ActionCard
              active={topPanel === "csv"}
              icon={<IconUpload className="size-5" />}
              title="Upload CSV"
              description="Import many questions at once from a formatted CSV file."
              action={
                <Button size="sm" disabled={!selectedBank} variant={topPanel === "csv" ? "default" : "outline"} onClick={() => openTopPanel("csv")}>
                  {topPanel === "csv" ? "Close" : "Upload CSV"}
                </Button>
              }
            />
            <ActionCard
              active={topPanel === "reuse"}
              icon={<IconCopy className="size-5" />}
              title="Reuse Questions"
              description="Copy questions from your other question banks."
              action={
                <Button size="sm" disabled={!selectedBank} variant={topPanel === "reuse" ? "default" : "outline"} onClick={() => openTopPanel("reuse")}>
                  {topPanel === "reuse" ? "Close" : "Browse questions"}
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">

          {/* ── Top panel: new question form ── */}
          {topPanel === "add" && (
            <InlineQuestionBuilder key="create-question" bankId={bankId} question={undefined} onSaved={handleSaved} onCancel={() => setTopPanel("none")} />
          )}

          {/* ── Top panel: CSV upload ── */}
          {topPanel === "csv" && (
            <CsvPanel
              csvFile={csvFile}
              csvPreview={csvPreview}
              csvIssues={csvIssues}
              isPreviewing={previewMutation.isPending}
              isImporting={importMutation.isPending}
              onPreview={(f) => previewMutation.mutate(f)}
              onClearPreview={() => { setCsvFile(null); setCsvPreview([]) }}
              onConfirm={() => csvFile && importMutation.mutate(csvFile)}
            />
          )}

          {/* ── Top panel: reuse ── */}
          {topPanel === "reuse" && (
            <ReusePanel
              banks={(allBanks.data ?? []).filter((b) => entityId(b) !== bankId)}
              sourceBankId={reuseSourceBankId}
              onSourceBankChange={(id) => { setReuseSourceBankId(id); setSelectedIds([]) }}
              candidates={reuseCandidates}
              isLoading={sourceQuestions.isPending}
              selectedIds={selectedIds}
              search={reuseSearch}
              onSearchChange={setReuseSearch}
              onToggle={(id) => setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])}
              onCopy={() => cloneMutation.mutate(selectedIds)}
              onClear={() => setSelectedIds([])}
              isCopying={cloneMutation.isPending}
            />
          )}

          {/* ── Questions list ── */}
          <div>
            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-50 flex-1">
                <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="pl-9" disabled={bulkMode} />
                {search && !bulkMode && (
                  <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <IconX className="size-4" />
                  </button>
                )}
              </div>
              {!bulkMode && (
                <div className="flex items-center gap-1 rounded-md border p-1">
                  {[{ key: "ALL", label: "All" }, { key: "SINGLE_SELECT", label: "Single" }, { key: "MULTIPLE_CHOICE", label: "Multi" }, { key: "TRUE_FALSE", label: "T/F" }].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTypeFilter(key)}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${typeFilter === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                      {typeCounts[key] != null && <span className={`text-[10px] ${typeFilter === key ? "opacity-70" : "opacity-50"}`}>{typeCounts[key]}</span>}
                    </button>
                  ))}
                </div>
              )}
              {bulkMode && filteredQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Select all ({filteredQuestions.length})
                </button>
              )}
              <Button
                size="sm"
                variant={bulkMode ? "default" : "outline"}
                onClick={toggleBulkMode}
                className={bulkMode ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                {bulkMode ? (
                  <><IconX className="size-4" /> Cancel</>
                ) : (
                  <><IconTrash className="size-4" /> Select to delete</>
                )}
              </Button>
            </div>

            {/* Cards */}
            {bank.isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-card p-5">
                    <div className="flex items-start gap-3">
                      <Skeleton className="size-6 rounded" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-56" /><Skeleton className="h-3 w-3/4" /></div>
                    </div>
                    <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-9 rounded-lg" />)}</div>
                  </div>
                ))}
              </div>
            ) : !filteredQuestions.length ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <IconFilter className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-medium">No questions found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search || typeFilter !== "ALL" ? "Try a different search or filter." : "This bank is empty. Create a question above to get started."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question, index) => (
                  // The inline builder replaces the card when editingId matches — never shown twice
                  editingId === entityId(question) ? (
                    <InlineQuestionBuilder
                      key={entityId(question)}
                      bankId={bankId}
                      question={question}
                      onSaved={handleSaved}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <QuestionCard
                      key={entityId(question)}
                      question={question}
                      index={index + 1}
                      onEdit={() => handleEditInline(entityId(question))}
                      onDelete={() => setDeleteTarget(question)}
                      bulkMode={bulkMode}
                      isSelected={bulkSelected.has(entityId(question))}
                      onToggleSelect={() => toggleBulkSelect(entityId(question))}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk delete action bar */}
      {bulkMode && (
        <div className="sticky bottom-0 border-t bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${bulkSelected.size > 0 ? "bg-destructive text-white" : "bg-muted text-muted-foreground"}`}>
                {bulkSelected.size}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {bulkSelected.size === 0 ? "No questions selected" : `${bulkSelected.size} question${bulkSelected.size === 1 ? "" : "s"} selected`}
                </p>
                <p className="text-xs text-muted-foreground">Click questions above to select them for deletion</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleBulkMode}>Cancel</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkSelected.size === 0 || bulkDeleteMutation.isPending}
                  >
                    <IconTrash className="size-4" />
                    {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${bulkSelected.size} selected`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {bulkSelected.size} question{bulkSelected.size === 1 ? "" : "s"}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      These questions will be deactivated and removed from this bank. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={bulkDeleteMutation.isPending}
                      onClick={(e) => { e.preventDefault(); bulkDeleteMutation.mutate(Array.from(bulkSelected)) }}
                    >
                      {bulkDeleteMutation.isPending ? "Deleting…" : `Remove ${bulkSelected.size} question${bulkSelected.size === 1 ? "" : "s"}`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this question?</AlertDialogTitle>
            <AlertDialogDescription>The question will be deactivated. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="line-clamp-3 font-medium">{deleteTarget.questionText}</p>
          </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleteMutation.isPending} onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteMutation.mutate(entityId(deleteTarget)) }}>
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({ icon, title, description, action, active }: {
  icon: React.ReactNode; title: string; description: string; action: React.ReactNode; active?: boolean
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors ${active ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  )
}

// ─── InlineQuestionBuilder ────────────────────────────────────────────────────

function InlineQuestionBuilder({ bankId, question, onSaved, onCancel }: {
  bankId: string; question?: Question; onSaved: () => void; onCancel: () => void
}) {
  const uid = useId()
  const isEdit = Boolean(question && entityId(question))

  const [questionType, setQuestionType] = useState<QType>(question?.questionType ?? "SINGLE_SELECT")
  const [questionText, setQuestionText] = useState(question?.questionText ?? "")
  const [marks, setMarks] = useState(String(question?.marks ?? 1))
  const [explanation, setExplanation] = useState(question?.explanation ?? "")

  const makeInitOptions = (q?: Question): OptionRow[] => {
    if (q?.options?.length) return q.options.map((o) => ({ key: o.key, text: o.text, explanation: "" }))
    return [
      { key: "A", text: "", explanation: "" },
      { key: "B", text: "", explanation: "" },
      { key: "C", text: "", explanation: "" },
      { key: "D", text: "", explanation: "" },
    ]
  }
  const makeInitCorrect = (q?: Question, type?: QType): string[] => {
    if (q?.correctAnswer?.length) return q.correctAnswer
    return (type ?? "SINGLE_SELECT") === "TRUE_FALSE" ? ["A"] : []
  }

  const [options, setOptions] = useState<OptionRow[]>(() => makeInitOptions(question))
  const [correctKeys, setCorrectKeys] = useState<string[]>(() => makeInitCorrect(question, question?.questionType))
  const [expandedExpl, setExpandedExpl] = useState<Set<string>>(new Set())

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      apiRequest(isEdit ? `/questions/${entityId(question!)}` : "/questions", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => { toast.success(isEdit ? "Question updated." : "Question added."); onSaved() },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!questionText.trim()) { toast.error("Question text is required."); return }
    if (questionType !== "TRUE_FALSE") {
      if (options.filter((o) => o.text.trim()).length < 2) { toast.error("At least 2 answer options are required."); return }
      if (correctKeys.length === 0) { toast.error("Select at least one correct answer."); return }
    }
    saveMutation.mutate(buildQuestionPayload(questionType, questionText, options, correctKeys, Number(marks), explanation, bankId))
  }

  function toggleCorrect(key: string) {
    if (questionType === "SINGLE_SELECT" || questionType === "TRUE_FALSE") setCorrectKeys([key])
    else setCorrectKeys((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
  }

  function updateOption(idx: number, field: keyof OptionRow, val: string) {
    setOptions((cur) => cur.map((o, i) => (i === idx ? { ...o, [field]: val } : o)))
  }

  function addOption() {
    const k = nextKey(options.map((o) => o.key))
    if (k) setOptions((cur) => [...cur, { key: k, text: "", explanation: "" }])
  }

  function removeOption(idx: number) {
    const rem = options[idx]
    setOptions((cur) => cur.filter((_, i) => i !== idx))
    setCorrectKeys((cur) => cur.filter((k) => k !== rem.key))
  }

  function toggleExpl(key: string) {
    setExpandedExpl((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isMC = questionType === "MULTIPLE_CHOICE"
  const isTF = questionType === "TRUE_FALSE"

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold">{isEdit ? "Edit Question" : "Create Question Manually"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isEdit ? "Update the question details below." : "Fill in the details, then click Add Question."}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <IconX className="size-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6 p-6">
          {/* Type + Points */}
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field>
              <FieldLabel htmlFor={`${uid}-type`}>Question Type</FieldLabel>
              <select
                id={`${uid}-type`}
                value={questionType}
                onChange={(e) => {
                  const nextType = e.target.value as QType
                  setQuestionType(nextType)
                  if (nextType === "TRUE_FALSE") setCorrectKeys(["A"])
                  else if (nextType === "SINGLE_SELECT") setCorrectKeys((current) => current.slice(0, 1))
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="SINGLE_SELECT">Single Choice</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="TRUE_FALSE">True / False</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-marks`}>Points</FieldLabel>
              <Input id={`${uid}-marks`} type="number" min="1" value={marks} onChange={(e) => setMarks(e.target.value)} required />
            </Field>
          </div>

          {/* Question text */}
          <Field>
            <FieldLabel htmlFor={`${uid}-text`}>Question</FieldLabel>
            <Textarea id={`${uid}-text`} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Write your question here…" rows={3} required />
          </Field>

          {/* Answer options */}
          <div>
            <FieldLabel className="mb-3">Answer Options</FieldLabel>

            {isTF ? (
              <div className="space-y-2">
                {[{ key: "A", label: "True" }, { key: "B", label: "False" }].map(({ key, label }) => {
                  const isCorrect = correctKeys.includes(key)
                  return (
                    <div key={key} onClick={() => toggleCorrect(key)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 select-none transition-colors ${isCorrect ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "hover:bg-muted/30"}`}>
                      <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isCorrect ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"}`}>
                        {isCorrect && <span className="size-2 rounded-full bg-white" />}
                      </div>
                      <span className={`text-sm font-medium ${isCorrect ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{label}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {options.map((opt, idx) => {
                  const isCorrect = correctKeys.includes(opt.key)
                  const hasExpl = expandedExpl.has(opt.key)
                  return (
                    <div key={opt.key} className="space-y-2">
                      <div className={`flex items-center gap-3 rounded-lg border transition-colors ${isCorrect ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20" : "bg-card"}`}>
                        {/* Selector */}
                        <button type="button" onClick={() => toggleCorrect(opt.key)} className="ml-3 shrink-0">
                          {isMC ? (
                            <div className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${isCorrect ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 hover:border-muted-foreground"}`}>
                              {isCorrect && <IconCheck className="size-3 text-white" />}
                            </div>
                          ) : (
                            <div className={`flex size-5 items-center justify-center rounded-full border-2 transition-colors ${isCorrect ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 hover:border-muted-foreground"}`}>
                              {isCorrect && <span className="size-2 rounded-full bg-white" />}
                            </div>
                          )}
                        </button>
                        {/* Key label */}
                        <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">{opt.key}</span>
                        {/* Text */}
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOption(idx, "text", e.target.value)}
                          placeholder={`Option ${opt.key}`}
                          className="flex-1 bg-transparent py-3 pr-2 text-sm outline-none placeholder:text-muted-foreground/50"
                        />
                        {/* Remove */}
                        {options.length > 2 && (
                          <button type="button" onClick={() => removeOption(idx)} className="mr-3 shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive">
                            <IconX className="size-4" />
                          </button>
                        )}
                      </div>
                      {/* Per-option explanation */}
                      <div className="pl-11">
                        {hasExpl ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={opt.explanation}
                              onChange={(e) => updateOption(idx, "explanation", e.target.value)}
                              placeholder="Explanation for this option…"
                              className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring/30"
                            />
                            <button type="button" onClick={() => toggleExpl(opt.key)} className="text-muted-foreground hover:text-foreground"><IconX className="size-4" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => toggleExpl(opt.key)} className="text-xs text-primary hover:underline">Add explanation for this option</button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {options.length < 6 && (
                  <button type="button" onClick={addOption}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                    <IconPlus className="size-4" /> Add Option
                  </button>
                )}
                <p className="text-xs text-muted-foreground">
                  {isMC ? "Check all correct answers." : "Select the single correct answer."}
                </p>
              </div>
            )}
          </div>

          {/* Explanation */}
          <Field>
            <FieldLabel htmlFor={`${uid}-expl`}>Explanation <span className="text-xs font-normal text-muted-foreground">(shown to candidates after exam)</span></FieldLabel>
            <Textarea id={`${uid}-expl`} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Optional — explain why the correct answer is right." rows={2} />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button disabled={saveMutation.isPending} className="min-w-35">
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "+ Add Question"}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({ question, index, onEdit, onDelete, bulkMode, isSelected, onToggleSelect }: {
  question: Question; index: number; onEdit: () => void; onDelete: () => void
  bulkMode?: boolean; isSelected?: boolean; onToggleSelect?: () => void
}) {
  function handleCardClick() {
    if (bulkMode) onToggleSelect?.()
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group rounded-xl border bg-card shadow-sm transition-all ${
        bulkMode
          ? isSelected
            ? "cursor-pointer border-destructive/60 bg-destructive/5 ring-1 ring-destructive/30"
            : "cursor-pointer hover:border-destructive/30 hover:bg-destructive/5"
          : "hover:border-border/80 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        {bulkMode && (
          <div className="mt-0.5 shrink-0">
            <div className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
              isSelected ? "border-destructive bg-destructive" : "border-muted-foreground/40"
            }`}>
              {isSelected && <IconCheck className="size-3 text-white" />}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-medium text-muted-foreground">#{index}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[question.questionType] ?? "bg-gray-50 text-gray-600"}`}>
              {TYPE_LABELS[question.questionType] ?? question.questionType}
            </span>
            <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium">
              {question.marks} pt{question.marks === 1 ? "" : "s"}
            </span>
            <StatusBadge status={question.status} />
          </div>
          <p className="text-sm font-medium leading-snug">{question.questionText}</p>
          {(question.topic || (question.tags ?? []).length > 0) && (
            <p className="text-xs text-muted-foreground">{[question.topic, ...(question.tags ?? [])].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {!bulkMode && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit() }} title="Edit question"><IconEdit className="size-4" /></Button>
            <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete() }} title="Remove question" className="text-muted-foreground hover:text-destructive"><IconTrash className="size-4" /></Button>
          </div>
        )}
      </div>
      <div className="space-y-1.5 px-5 pb-5">
        {question.options.map((opt) => {
          const correct = question.correctAnswer?.includes(opt.key)
          return (
            <div key={opt.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${correct ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30" : "bg-muted/10"}`}>
              <span className={`shrink-0 font-mono text-xs font-semibold ${correct ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{opt.key}</span>
              <span className={`flex-1 ${correct ? "font-medium text-emerald-800 dark:text-emerald-300" : "text-muted-foreground"}`}>{opt.text}</span>
              {correct && <IconCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            </div>
          )
        })}
      </div>
      {question.explanation && (
        <div className="mx-5 mb-5 rounded-lg border bg-muted/20 px-4 py-3 text-xs">
          <span className="font-medium text-foreground">Explanation: </span>
          <span className="text-muted-foreground">{question.explanation}</span>
        </div>
      )}
    </div>
  )
}

// ─── CsvPanel ─────────────────────────────────────────────────────────────────

function CsvPanel({ csvFile, csvPreview, csvIssues, isPreviewing, isImporting, onPreview, onClearPreview, onConfirm }: {
  csvFile: File | null
  csvPreview: ImportPreviewRow[]
  csvIssues: Array<Record<string, unknown>>
  isPreviewing: boolean
  isImporting: boolean
  onPreview: (f: File) => void
  onClearPreview: () => void
  onConfirm: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) onPreview(file)
    else toast.error("Please drop a .csv file.")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Import Questions via CSV</CardTitle>
            <CardDescription className="mt-1">
              Upload a CSV file to import multiple questions at once. Download the template below to see the exact format required.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => downloadApiFile("/questions/import-template", "argus-question-template.csv")}>
            <IconDownload className="size-4" />
            Download template
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Format reference table */}
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected CSV format</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  {["questionType", "questionText", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "marks", "explanation"].map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-mono font-medium text-muted-foreground">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2 font-mono text-blue-600">SINGLE_SELECT</td>
                  <td className="px-3 py-2 max-w-48 truncate text-muted-foreground">What is the capital of France?</td>
                  <td className="px-3 py-2 text-muted-foreground">Paris</td>
                  <td className="px-3 py-2 text-muted-foreground">London</td>
                  <td className="px-3 py-2 text-muted-foreground">Berlin</td>
                  <td className="px-3 py-2 text-muted-foreground">Rome</td>
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-600">A</td>
                  <td className="px-3 py-2 text-muted-foreground">1</td>
                  <td className="px-3 py-2 text-muted-foreground">Paris is the capital…</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 font-mono text-violet-600">MULTIPLE_CHOICE</td>
                  <td className="px-3 py-2 max-w-48 truncate text-muted-foreground">Which are primary colors?</td>
                  <td className="px-3 py-2 text-muted-foreground">Red</td>
                  <td className="px-3 py-2 text-muted-foreground">Blue</td>
                  <td className="px-3 py-2 text-muted-foreground">Green</td>
                  <td className="px-3 py-2 text-muted-foreground">Yellow</td>
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-600">A,B</td>
                  <td className="px-3 py-2 text-muted-foreground">2</td>
                  <td className="px-3 py-2 text-muted-foreground" />
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-amber-600">TRUE_FALSE</td>
                  <td className="px-3 py-2 max-w-48 truncate text-muted-foreground">The sun is a star.</td>
                  <td className="px-3 py-2 text-muted-foreground" />
                  <td className="px-3 py-2 text-muted-foreground" />
                  <td className="px-3 py-2 text-muted-foreground" />
                  <td className="px-3 py-2 text-muted-foreground" />
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-600">A</td>
                  <td className="px-3 py-2 text-muted-foreground">1</td>
                  <td className="px-3 py-2 text-muted-foreground" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
            For True/False: A = True, B = False. For Multiple Choice with multiple correct answers, separate keys with commas: <code className="font-mono text-foreground">A,C</code>
          </div>
        </div>

        {/* Drop zone */}
        {!csvPreview.length && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/20"}`}
          >
            <div className={`flex size-12 items-center justify-center rounded-full transition-colors ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
              <IconUpload className={`size-6 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-medium">{isPreviewing ? "Parsing file…" : "Drag & drop or click to upload"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Accepts .csv files only</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" disabled={isPreviewing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPreview(f); e.target.value = "" }}
            />
          </div>
        )}

        {/* Preview */}
        {csvPreview.length > 0 && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Preview — ready to import</p>
                <p className="text-xs text-muted-foreground">{csvFile?.name} · {csvPreview.length} question{csvPreview.length === 1 ? "" : "s"} detected</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClearPreview}>Clear</Button>
                <Button size="sm" disabled={!csvFile || isImporting} onClick={onConfirm}>
                  {isImporting ? "Importing…" : `Import ${csvPreview.length} question${csvPreview.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {csvPreview.slice(0, 5).map((row) => (
                <div key={`${row.row}-${row.questionText}`} className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Row {row.row}</span>
                    <span className={`rounded-full border px-1.5 py-0.5 ${TYPE_COLORS[row.questionType] ?? ""}`}>{TYPE_LABELS[row.questionType] ?? row.questionType}</span>
                    <span className="text-muted-foreground">{row.marks} pt{row.marks === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-1 font-medium">{row.questionText}</p>
                  <p className="mt-0.5 text-muted-foreground">{row.optionCount} options · Correct: {row.correctAnswer.join(", ")}</p>
                </div>
              ))}
              {csvPreview.length > 5 && <p className="text-xs text-muted-foreground">+{csvPreview.length - 5} more rows…</p>}
            </div>
          </div>
        )}

        {/* Errors */}
        {csvIssues.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs">
            <p className="mb-2 flex items-center gap-1.5 font-medium text-destructive">
              <IconAlertTriangle className="size-4" />
              {csvIssues.length} row{csvIssues.length === 1 ? "" : "s"} with errors
            </p>
            <div className="space-y-2">
              {csvIssues.slice(0, 5).map((issue, i) => (
                <div key={i} className="rounded-md border bg-background px-3 py-2">
                  <p className="font-medium">Row {String(issue.row ?? i + 1)}</p>
                  <div className="mt-1 space-y-0.5 text-muted-foreground">{issueMessages(issue).map((msg) => <p key={msg}>{msg}</p>)}</div>
                </div>
              ))}
              {csvIssues.length > 5 && <p className="text-muted-foreground">+{csvIssues.length - 5} more errors…</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── ReusePanel ───────────────────────────────────────────────────────────────

function ReusePanel({ banks, sourceBankId, onSourceBankChange, candidates, isLoading, selectedIds, search, onSearchChange, onToggle, onCopy, onClear, isCopying }: {
  banks: QuestionBankType[]
  sourceBankId: string
  onSourceBankChange: (id: string) => void
  candidates: Question[]
  isLoading: boolean
  selectedIds: string[]
  search: string
  onSearchChange: (v: string) => void
  onToggle: (id: string) => void
  onCopy: () => void
  onClear: () => void
  isCopying: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reuse from other banks</CardTitle>
        <CardDescription>Select questions from another bank to copy into this one. Copied questions are independent of the original.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bank filter */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Filter by question bank</FieldLabel>
            <select
              value={sourceBankId}
              onChange={(e) => onSourceBankChange(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="ALL">All my banks</option>
              {banks.map((b) => (
                <option key={entityId(b)} value={entityId(b)}>{b.title}</option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel>Search questions</FieldLabel>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by text or topic…" className="pl-9" />
            </div>
          </Field>
        </div>

        {/* Question list */}
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : candidates.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {search ? "No questions match your search." : sourceBankId === "ALL" ? "No questions available from your other banks." : "This bank has no questions available to copy."}
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-2">
            {candidates.map((q) => {
              const id = entityId(q)
              const isSelected = selectedIds.includes(id)
              // Show which bank this question is from
              const fromBank = typeof q.questionBank === "object" && q.questionBank !== null
                ? (q.questionBank as QuestionBankType).title
                : null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggle(id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full border px-1.5 py-0.5 text-xs ${TYPE_COLORS[q.questionType] ?? ""}`}>{TYPE_LABELS[q.questionType] ?? q.questionType}</span>
                        <span className="text-xs text-muted-foreground">{q.marks} pt{q.marks === 1 ? "" : "s"}</span>
                        {fromBank && <span className="text-xs text-muted-foreground">· {fromBank}</span>}
                      </div>
                      <p className="font-medium leading-snug">{q.questionText}</p>
                      {q.topic && <p className="mt-0.5 text-xs text-muted-foreground">{q.topic}</p>}
                    </div>
                    {isSelected && <IconCircleCheck className="mt-0.5 size-5 shrink-0 text-primary" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
      {selectedIds.length > 0 && (
        <CardFooter className="border-t pt-4">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{selectedIds.length} question{selectedIds.length === 1 ? "" : "s"} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
              <Button size="sm" disabled={isCopying} onClick={onCopy}>
                <IconCopy className="size-4" />
                {isCopying ? "Copying…" : `Copy ${selectedIds.length} question${selectedIds.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
