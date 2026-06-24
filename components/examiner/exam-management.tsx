"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  IconArchive,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconLock,
  IconPlus,
  IconRocket,
  IconSearch,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { ApiRequestError, apiRequest } from "@/lib/api/client"
import type { Exam, ExamStatus } from "@/lib/api/types"

// ─── Metadata ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<ExamStatus, { label: string; color: string }> = {
  DRAFT:     { label: "Draft",     color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800" },
  PUBLISHED: { label: "Published", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40" },
  SCHEDULED: { label: "Scheduled", color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40" },
  ACTIVE:    { label: "Active",    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" },
  CLOSED:    { label: "Closed",    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40" },
  DISABLED:  { label: "Disabled",  color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40" },
  CANCELLED: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40" },
  ARCHIVED:  { label: "Archived",  color: "bg-muted/60 text-muted-foreground border-border" },
}

const ACCESS_META: Record<string, { label: string; icon: React.ReactNode }> = {
  PUBLIC_LINK_WITH_CODE:    { label: "Public",  icon: <IconWorld className="size-3.5" /> },
  LOGIN_REQUIRED_WITH_CODE: { label: "Private", icon: <IconLock  className="size-3.5" /> },
  INVITE_ONLY:              { label: "Private", icon: <IconLock  className="size-3.5" /> },
}

const STATUS_FILTERS: Array<{ key: ExamStatus | "ALL"; label: string }> = [
  { key: "ALL",       label: "All"       },
  { key: "DRAFT",     label: "Draft"     },
  { key: "PUBLISHED", label: "Published" },
  { key: "ACTIVE",    label: "Active"    },
  { key: "CLOSED",    label: "Closed"    },
  { key: "ARCHIVED",  label: "Archived"  },
]

function fmtDate(d?: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── ExamManagement ───────────────────────────────────────────────────────────

export function ExamManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "ALL">("ALL")
  const [accessFilter, setAccessFilter] = useState<string>("ALL")
  const [filterOpen, setFilterOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{
    exam: Exam; action: "publish" | "unpublish" | "close" | "archive" | "delete"
  } | null>(null)

  const exams = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiRequest<Exam[]>("/exams?limit=200").then((r) => r.data),
  })

  const actionMutation = useMutation({
    mutationFn: ({ exam, action }: { exam: Exam; action: string }) => {
      const id = entityId(exam)
      if (action === "publish")   return apiRequest(`/exams/${id}/publish`,   { method: "POST" })
      if (action === "unpublish") return apiRequest(`/exams/${id}/unpublish`, { method: "POST" })
      if (action === "close")     return apiRequest(`/exams/${id}/close`,     { method: "POST" })
      if (action === "archive")   return apiRequest(`/exams/${id}/archive`,   { method: "POST" })
      if (action === "delete")    return apiRequest(`/exams/${id}/permanent`, { method: "DELETE" })
      throw new Error("Unknown action.")
    },
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = {
        publish: "Exam published.", unpublish: "Exam unpublished.", close: "Exam closed.",
        archive: "Exam archived.", delete: "Exam permanently deleted.",
      }
      toast.success(labels[vars.action] ?? "Done.")
      setActionTarget(null)
      queryClient.invalidateQueries({ queryKey: ["exams"] })
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const filtered = useMemo(() => {
    return (exams.data ?? []).filter((e) => {
      const q = search.toLowerCase()
      const matchSearch = !q || e.title.toLowerCase().includes(q) || (e.code ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q)
      const matchStatus = statusFilter === "ALL" || e.status === statusFilter
      const matchAccess = accessFilter === "ALL" || e.accessType === accessFilter ||
        (accessFilter === "LOGIN_REQUIRED_WITH_CODE" && e.accessType === "INVITE_ONLY")
      return matchSearch && matchStatus && matchAccess
    })
  }, [exams.data, search, statusFilter, accessFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: exams.data?.length ?? 0 }
    for (const e of exams.data ?? []) c[e.status] = (c[e.status] ?? 0) + 1
    return c
  }, [exams.data])

  const activeFilterCount = (statusFilter !== "ALL" ? 1 : 0) + (accessFilter !== "ALL" ? 1 : 0)

  return (
    <div className="flex min-h-full flex-col bg-[#f8f9fc] dark:bg-background">

      {/* ── Hero ── */}
      <div className="border-b bg-white px-4 pb-5 pt-6 dark:bg-card sm:px-6 sm:pb-6 sm:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:size-9">
                  <IconClipboardList className="size-4 text-primary sm:size-5" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Exams</h1>
              </div>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                Create and manage your exams. Publish, monitor candidates, and review results.
              </p>
              {exams.data && exams.data.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs sm:gap-4 sm:text-sm">
                  <span>
                    <strong className="text-foreground">{exams.data.length}</strong>
                    <span className="ml-1 text-muted-foreground">exam{exams.data.length === 1 ? "" : "s"}</span>
                  </span>
                  {(counts["ACTIVE"] ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {counts["ACTIVE"]} active
                    </span>
                  )}
                  {(counts["DRAFT"] ?? 0) > 0 && (
                    <span className="text-muted-foreground">{counts["DRAFT"]} draft{counts["DRAFT"] === 1 ? "" : "s"}</span>
                  )}
                  {(counts["PUBLISHED"] ?? 0) > 0 && (
                    <span className="text-muted-foreground">{counts["PUBLISHED"]} published</span>
                  )}
                </div>
              )}
            </div>

            <Button asChild size="sm" className="shrink-0 gap-1.5">
              <Link href="/examiner/exams/create">
                <IconPlus className="size-4" />
                <span className="hidden sm:inline">Create Exam</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="border-b bg-white px-4 py-3 dark:bg-card sm:px-6">
        <div className="mx-auto max-w-5xl space-y-3">
          {/* Search + filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, code, or description…"
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-9 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filterOpen || activeFilterCount > 0
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <IconFilter className="size-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Expanded filter panel */}
          {filterOpen && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border bg-muted/20 px-3 py-3">
              {/* Status */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                <div className="flex flex-wrap gap-1">
                  {STATUS_FILTERS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        statusFilter === key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {label}
                      {counts[key] != null && (
                        <span className={`text-[10px] ${statusFilter === key ? "opacity-75" : "opacity-50"}`}>{counts[key]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden h-4 w-px bg-border sm:block" />

              {/* Access */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Access</span>
                <div className="relative">
                  <select
                    value={accessFilter}
                    onChange={(e) => setAccessFilter(e.target.value)}
                    className="h-7 appearance-none rounded-md border bg-background pl-2.5 pr-7 text-xs font-medium outline-none focus:border-ring"
                  >
                    <option value="ALL">All types</option>
                    <option value="PUBLIC_LINK_WITH_CODE">Public</option>
                    <option value="LOGIN_REQUIRED_WITH_CODE">Private</option>
                  </select>
                  <IconChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter("ALL"); setAccessFilter("ALL") }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3" /> Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-5xl">
          {!exams.isPending && (exams.data?.length ?? 0) > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {filtered.length === (exams.data?.length ?? 0)
                ? `${filtered.length} exam${filtered.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${exams.data?.length} exam${(exams.data?.length ?? 0) === 1 ? "" : "s"}`}
            </p>
          )}

          {exams.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-white p-4 dark:bg-card sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Skeleton className="hidden size-10 shrink-0 rounded-lg sm:block" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 sm:w-56" />
                      <Skeleton className="h-3 w-56 sm:w-72" />
                      <div className="flex gap-2"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-18 rounded-full" /></div>
                    </div>
                    <Skeleton className="size-7 shrink-0 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasExams={(exams.data?.length ?? 0) > 0} />
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {filtered.map((exam) => (
                <ExamCard key={entityId(exam)} exam={exam} onAction={(action) => setActionTarget({ exam, action })} />
              ))}
            </div>
          )}
        </div>
      </div>

      {actionTarget && (
        <ActionDialog
          exam={actionTarget.exam}
          action={actionTarget.action}
          isPending={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate(actionTarget)}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasExams }: { hasExams: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center dark:bg-card sm:py-20">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
        <IconClipboardList className="size-6 text-muted-foreground/60" />
      </div>
      {hasExams ? (
        <>
          <h3 className="mt-4 text-sm font-semibold">No exams match your filters</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or clearing filters.</p>
        </>
      ) : (
        <>
          <h3 className="mt-4 text-sm font-semibold">No exams yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Create your first exam to start assessing candidates with built-in anti-cheat monitoring.
          </p>
          <Button asChild size="sm" className="mt-5 gap-1.5">
            <Link href="/examiner/exams/create">
              <IconPlus className="size-4" /> Create your first exam
            </Link>
          </Button>
        </>
      )}
    </div>
  )
}

// ─── ExamCard ─────────────────────────────────────────────────────────────────

function ExamCard({ exam, onAction }: {
  exam: Exam
  onAction: (action: "publish" | "unpublish" | "close" | "archive" | "delete") => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = exam.status
  const meta = STATUS_META[status]
  const access = exam.accessType ? ACCESS_META[exam.accessType] : null
  const qCount = Array.isArray(exam.questions) ? exam.questions.length : 0

  return (
    <div className="group rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-card">
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">

        {/* Status icon — hidden on mobile, visible sm+ */}
        <div className={`hidden shrink-0 items-center justify-center rounded-lg border sm:flex size-10 ${
          status === "ACTIVE"    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30" :
          status === "PUBLISHED" ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30" :
          status === "SCHEDULED" ? "border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30" :
                                   "border-muted/60 bg-muted/30"
        }`}>
          {status === "ACTIVE"    && <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />}
          {status === "PUBLISHED" && <IconRocket   className="size-4.5 text-blue-600   dark:text-blue-400"   />}
          {status === "DRAFT"     && <IconEdit     className="size-4.5 text-muted-foreground"                />}
          {status === "SCHEDULED" && <IconCalendar className="size-4.5 text-violet-600 dark:text-violet-400" />}
          {status === "CLOSED"    && <IconCheck    className="size-4.5 text-amber-600  dark:text-amber-400"  />}
          {(status === "ARCHIVED" || status === "DISABLED" || status === "CANCELLED") &&
            <IconArchive className="size-4.5 text-muted-foreground" />}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title + badges */}
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <Link
              href={`/examiner/exams/${entityId(exam)}`}
              className="text-sm font-semibold leading-snug transition-colors hover:text-primary hover:underline underline-offset-2 sm:text-base"
            >
              {exam.title}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {exam.code && (
                <span className="font-mono text-[11px] text-muted-foreground">{exam.code}</span>
              )}
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          </div>

          {/* Description */}
          {exam.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">{exam.description}</p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <IconClipboardList className="size-3.5 shrink-0" />
              {qCount} question{qCount === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1">
              <IconClock className="size-3.5 shrink-0" />
              {fmtDuration(exam.durationMinutes)}
            </span>
            {access && (
              <span className="flex items-center gap-1">{access.icon}{access.label}</span>
            )}
            {exam.startTime && (
              <span className="hidden items-center gap-1 sm:flex">
                <IconCalendar className="size-3.5 shrink-0" />
                {fmtDate(exam.startTime)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Link href={`/examiner/exams/${entityId(exam)}`}>
            <button
              type="button"
              title="View exam"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconEye className="size-4" />
            </button>
          </Link>

          <div className="relative">
            <button
              type="button"
              title="More actions"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((c) => !c) }}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                menuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <IconDotsVertical className="size-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-30 min-w-48 overflow-hidden rounded-xl border bg-popover shadow-lg">
                  <div className="py-1.5">
                    <MenuLink href={`/examiner/exams/${entityId(exam)}`} icon={<IconEye className="size-4" />} onClick={() => setMenuOpen(false)}>
                      View &amp; manage
                    </MenuLink>
                    <MenuLink href={`/examiner/exams/${entityId(exam)}/edit`} icon={<IconEdit className="size-4" />} onClick={() => setMenuOpen(false)}>
                      Edit settings
                    </MenuLink>

                    <div className="my-1 border-t" />

                    {status === "DRAFT" && (
                      <MenuItem icon={<IconRocket className="size-4 text-blue-500" />} onClick={() => { setMenuOpen(false); onAction("publish") }}>
                        Publish
                      </MenuItem>
                    )}
                    {(status === "PUBLISHED" || status === "SCHEDULED") && (
                      <MenuItem icon={<IconArrowLeft className="size-4 text-muted-foreground" />} onClick={() => { setMenuOpen(false); onAction("unpublish") }}>
                        Unpublish
                      </MenuItem>
                    )}
                    {(status === "PUBLISHED" || status === "ACTIVE") && (
                      <MenuItem icon={<IconCheck className="size-4 text-amber-500" />} onClick={() => { setMenuOpen(false); onAction("close") }}>
                        Close exam
                      </MenuItem>
                    )}
                    {(status === "CLOSED" || status === "DRAFT") && (
                      <MenuItem icon={<IconArchive className="size-4 text-muted-foreground" />} onClick={() => { setMenuOpen(false); onAction("archive") }}>
                        Archive
                      </MenuItem>
                    )}

                    <div className="my-1 border-t" />

                    <MenuItem icon={<IconTrash className="size-4" />} destructive onClick={() => { setMenuOpen(false); onAction("delete") }}>
                      Delete permanently
                    </MenuItem>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Menu helpers ─────────────────────────────────────────────────────────────

function MenuLink({ href, icon, onClick, children }: {
  href: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode
}) {
  return (
    <Link href={href} onClick={onClick}>
      <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-foreground hover:bg-muted/60">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </button>
    </Link>
  )
}

function MenuItem({ icon, destructive = false, onClick, children }: {
  icon: React.ReactNode; destructive?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
        destructive ? "text-destructive hover:bg-destructive/5" : "text-foreground hover:bg-muted/60"
      }`}
    >
      <span className={destructive ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
      {children}
    </button>
  )
}

// ─── ActionDialog ─────────────────────────────────────────────────────────────

function ActionDialog({ exam, action, isPending, onConfirm, onClose }: {
  exam: Exam; action: "publish" | "unpublish" | "close" | "archive" | "delete"
  isPending: boolean; onConfirm: () => void; onClose: () => void
}) {
  const [confirmInput, setConfirmInput] = useState("")

  const config = {
    publish: {
      title: "Publish this exam?",
      description: "Candidates will be able to access this exam once published. Make sure you have reviewed all questions and settings.",
      confirmLabel: "Publish exam", variant: "default" as const, requiresTypedConfirm: false,
    },
    unpublish: {
      title: "Unpublish this exam?",
      description: "The exam returns to draft. Candidates can no longer access it until you publish again.",
      confirmLabel: "Unpublish exam", variant: "default" as const, requiresTypedConfirm: false,
    },
    close: {
      title: "Close this exam?",
      description: "No new attempts will be accepted. Candidates currently in-progress will be auto-submitted.",
      confirmLabel: "Close exam", variant: "default" as const, requiresTypedConfirm: false,
    },
    archive: {
      title: "Archive this exam?",
      description: "The exam is hidden from your active list but all data — questions, attempts, and results — is preserved. You can restore it later.",
      confirmLabel: "Archive exam", variant: "default" as const, requiresTypedConfirm: false,
    },
    delete: {
      title: "Permanently delete this exam?",
      description: "This will irreversibly remove the exam, all questions, candidate attempts, and results. There is no way to recover this data.",
      confirmLabel: "Permanently delete", variant: "destructive" as const, requiresTypedConfirm: true,
    },
  }[action]

  const canConfirm = !config.requiresTypedConfirm || confirmInput === exam.title

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={action === "delete" ? "text-destructive" : ""}>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">{exam.title}</p>
          {exam.code && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{exam.code}</p>}
        </div>

        {config.requiresTypedConfirm && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <strong className="select-all font-semibold text-foreground">{exam.title}</strong> to confirm.
            </p>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={exam.title}
              autoFocus
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={config.variant}
            disabled={isPending || !canConfirm}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
          >
            {isPending ? "Please wait…" : config.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
