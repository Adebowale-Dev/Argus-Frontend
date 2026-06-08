"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconClipboardList,
  IconLock,
  IconSearch,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { entityId } from "@/components/workspace/page-elements"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError, apiRequest } from "@/lib/api/client"
import type { AntiCheatSettings, Exam, Question, QuestionBank } from "@/lib/api/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessType = "PUBLIC_LINK_WITH_CODE" | "LOGIN_REQUIRED_WITH_CODE"
type AvailabilityMode = "ALWAYS_OPEN" | "SCHEDULED" | "CLOSED_MANUALLY"
type CandidateFieldType = "text" | "email" | "tel" | "number"
type CandidateCustomField = {
  key: string
  label: string
  type: CandidateFieldType
  placeholder: string
  required: boolean
}
type CandidateIdentityRequirements = {
  fullName: boolean
  email: boolean
  phone: boolean
  identifier: boolean
  customFields: CandidateCustomField[]
}

type FormState = {
  title: string
  description: string
  instructions: string
  durationMinutes: string
  passMark: string
  questionBankId: string
  selectedQuestionIds: string[]
  accessType: AccessType
  availabilityMode: AvailabilityMode
  startTime: string
  endTime: string
  candidateIdentityRequirements: CandidateIdentityRequirements
  randomizeQuestions: boolean
  randomizeOptions: boolean
  showResultImmediately: boolean
  maxAttempts: string
  antiCheat: AntiCheatSettings
}

const defaultCandidateIdentityRequirements: CandidateIdentityRequirements = {
  fullName: true,
  email: true,
  phone: false,
  identifier: false,
  customFields: [],
}

const defaultAntiCheat: AntiCheatSettings = {
  requireFullscreen: true,
  detectTabSwitch: true,
  detectWindowBlur: true,
  disableRightClick: true,
  disableCopyPaste: true,
  blockDevToolsShortcuts: true,
  preventMultipleSessions: true,
  requireWebcam: false,
  captureSnapshots: false,
  captureScreenshots: false,
  maxTabSwitches: 3,
  maxFullscreenExits: 3,
  autoSubmitViolationScore: 100,
  warningViolationScore: 30,
  finalWarningViolationScore: 70,
}

function toLocalDatetime(iso?: string) {
  if (!iso) return ""
  // datetime-local needs "YYYY-MM-DDTHH:MM"
  return iso.slice(0, 16)
}

function examToForm(exam: Exam): FormState {
  const qIds = (exam.questions ?? []).map((q) =>
    typeof q === "string" ? q : entityId(q as Question)
  )
  const bankId =
    typeof exam.questionBank === "string"
      ? exam.questionBank
      : exam.questionBank
        ? entityId(exam.questionBank)
        : ""
  return {
    title: exam.title ?? "",
    description: exam.description ?? "",
    instructions: exam.instructions ?? "",
    durationMinutes: String(exam.durationMinutes ?? 60),
    passMark: exam.passMark != null ? String(exam.passMark) : "",
    questionBankId: bankId,
    selectedQuestionIds: qIds,
    accessType: exam.accessType === "INVITE_ONLY" ? "LOGIN_REQUIRED_WITH_CODE" : (exam.accessType ?? "PUBLIC_LINK_WITH_CODE"),
    availabilityMode: exam.availabilityMode ?? "ALWAYS_OPEN",
    startTime: toLocalDatetime(exam.startTime),
    endTime: toLocalDatetime(exam.endTime),
    candidateIdentityRequirements: {
      ...defaultCandidateIdentityRequirements,
      ...(exam.candidateIdentityRequirements ?? {}),
      customFields: (exam.candidateIdentityRequirements?.customFields ?? []).map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder ?? "",
        required: Boolean(field.required),
      })),
    },
    randomizeQuestions: exam.randomizeQuestions ?? true,
    randomizeOptions: exam.randomizeOptions ?? false,
    showResultImmediately: exam.showResultImmediately ?? true,
    maxAttempts: String(exam.maxAttempts ?? 1),
    antiCheat: { ...defaultAntiCheat, ...(exam.antiCheatSettings ?? {}) },
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Questions" },
  { id: 3, label: "Access" },
  { id: 4, label: "Candidate Form" },
  { id: 5, label: "Settings" },
  { id: 6, label: "Anti-Cheat" },
  { id: 7, label: "Review" },
]

// ─── ExamEdit ─────────────────────────────────────────────────────────────────

export function ExamEdit() {
  const { examId } = useParams<{ examId: string }>()

  const examQuery = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => apiRequest<Exam>(`/exams/${examId}`).then((r) => r.data),
  })
  const unpublishMutation = useMutation({
    mutationFn: () => apiRequest(`/exams/${examId}/unpublish`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Exam unpublished. You can edit it now.")
      examQuery.refetch()
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  // ── Loading state ──
  if (examQuery.isPending) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b bg-card px-6 py-5">
          <div className="mx-auto max-w-4xl space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (examQuery.isError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center py-20 text-center">
        <IconAlertTriangle className="size-10 text-destructive mb-3" />
        <p className="text-sm font-medium">Failed to load exam.</p>
        <Link href="/examiner/exams" className="mt-3 text-sm text-primary hover:underline">Back to exams</Link>
      </div>
    )
  }

  if (examQuery.data && examQuery.data.status !== "DRAFT") {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b bg-card px-6 py-5">
          <div className="mx-auto max-w-4xl">
            <Link
              href={`/examiner/exams/${examId}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconArrowLeft className="size-4" />
              Back to exam
            </Link>
            <div className="mt-3">
              <h1 className="text-xl font-semibold">Unpublish before editing</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{examQuery.data.title}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <IconAlertTriangle className="size-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">This exam is currently {examQuery.data.status.toLowerCase()}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    To keep published settings stable for candidates, exams must be unpublished and returned to draft before you can edit questions, access mode, timing, or anti-cheat settings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(examQuery.data.status === "PUBLISHED" || examQuery.data.status === "SCHEDULED") && (
                    <Button onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending}>
                      {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish exam"}
                    </Button>
                  )}
                  <Link href={`/examiner/exams/${examId}`}>
                    <Button variant="outline">Return to control room</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!examQuery.data) {
    return null
  }

  return <ExamEditDraft exam={examQuery.data} />
}

function ExamEditDraft({ exam }: { exam: Exam }) {
  const { examId } = useParams<{ examId: string }>()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(() => examToForm(exam))

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }))
  }

  const updateMutation = useMutation({
    mutationFn: (body: object) =>
      apiRequest(`/exams/${examId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Exam updated.")
      router.push(`/examiner/exams/${examId}`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  function buildPayload(f: FormState) {
    return {
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      instructions: f.instructions.trim() || undefined,
      durationMinutes: Number(f.durationMinutes),
      passMark: f.passMark ? Number(f.passMark) : undefined,
      questionBank: f.questionBankId || undefined,
      questions: f.selectedQuestionIds,
      accessType: f.accessType,
      availabilityMode: f.availabilityMode,
      startTime: f.startTime || undefined,
      endTime: f.endTime || undefined,
      candidateIdentityRequirements: {
        ...f.candidateIdentityRequirements,
        customFields: f.candidateIdentityRequirements.customFields.map((field) => ({
          key: field.key.trim(),
          label: field.label.trim(),
          type: field.type,
          placeholder: field.placeholder.trim(),
          required: field.required,
        })),
      },
      randomizeQuestions: f.randomizeQuestions,
      randomizeOptions: f.randomizeOptions,
      showResultImmediately: f.showResultImmediately,
      maxAttempts: Number(f.maxAttempts) || 1,
      antiCheatSettings: f.antiCheat,
    }
  }

  function handleSave() {
    if (!form.title.trim()) { toast.error("Exam title is required."); setStep(1); return }
    if (!form.instructions.trim()) { toast.error("Instructions are required."); setStep(1); return }
    if (form.selectedQuestionIds.length === 0) { toast.error("Select at least one question."); setStep(2); return }
    if (form.candidateIdentityRequirements.customFields.some((field) => !field.key.trim() || !field.label.trim())) {
      toast.error("Every custom candidate field must have both a label and a key.")
      setStep(4)
      return
    }
    updateMutation.mutate(buildPayload(form))
  }

  const canNext = useMemo(() => {
    if (step === 1) return form.title.trim().length > 0 && form.instructions.trim().length > 0 && Number(form.durationMinutes) > 0
    if (step === 2) return form.selectedQuestionIds.length > 0
    return true
  }, [step, form])

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <Link
            href={`/examiner/exams/${examId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft className="size-4" />
            Back to exam
          </Link>
          <div className="mt-3">
            <h1 className="text-xl font-semibold">Edit Exam</h1>
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{exam.title}</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b bg-muted/20 px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => (done || active) && setStep(s.id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground" :
                      done ? "text-foreground hover:bg-muted" :
                      "text-muted-foreground"
                    }`}
                  >
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" :
                      done ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <IconCheck className="size-3" /> : s.id}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <IconChevronRight className="size-4 shrink-0 text-muted-foreground/40" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {step === 1 && <EditStepBasicInfo form={form} patch={patch} />}
          {step === 2 && <EditStepQuestions form={form} patch={patch} />}
          {step === 3 && <EditStepAccess form={form} patch={patch} />}
          {step === 4 && <EditStepCandidateDetails form={form} patch={patch} />}
          {step === 5 && <EditStepSettings form={form} patch={patch} />}
          {step === 6 && <EditStepAntiCheat form={form} patch={patch} />}
          {step === 7 && <EditStepReview form={form} onSave={handleSave} isPending={updateMutation.isPending} />}
        </div>
      </div>

      {/* Nav footer */}
      {step < STEPS.length && (
        <div className="sticky bottom-0 border-t bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              <IconArrowLeft className="size-4" />Previous
            </Button>
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Next<IconArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 1: Basic Info ───────────────────────────────────────────────────────

function EditStepBasicInfo({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update the exam title, description, and duration.</p>
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <Field>
          <FieldLabel htmlFor={`${uid}-title`}>Exam title <span className="text-destructive">*</span></FieldLabel>
          <Input id={`${uid}-title`} value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={120} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${uid}-desc`}>Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></FieldLabel>
          <Textarea id={`${uid}-desc`} value={form.description} onChange={(e) => patch({ description: e.target.value })} rows={3} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${uid}-inst`}>Instructions <span className="text-destructive">*</span></FieldLabel>
          <Textarea id={`${uid}-inst`} value={form.instructions} onChange={(e) => patch({ instructions: e.target.value })} rows={4} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${uid}-dur`}>Duration (minutes) <span className="text-destructive">*</span></FieldLabel>
            <Input id={`${uid}-dur`} type="number" min={1} max={600} value={form.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-pass`}>Pass mark <span className="text-xs font-normal text-muted-foreground">(required before publish)</span></FieldLabel>
            <Input id={`${uid}-pass`} type="number" min={0} value={form.passMark} onChange={(e) => patch({ passMark: e.target.value })} placeholder="e.g. 50" />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Questions ────────────────────────────────────────────────────────

function EditStepQuestions({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const [search, setSearch] = useState("")

  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => apiRequest<QuestionBank[]>("/question-banks?limit=100").then((r) => r.data),
  })

  const bankId = form.questionBankId
  const bankQuestions = useQuery({
    queryKey: ["question-bank", bankId, "questions"],
    queryFn: () => apiRequest<Question[]>(`/question-banks/${bankId}/questions?limit=500`).then((r) => r.data),
    enabled: Boolean(bankId),
  })

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    return (bankQuestions.data ?? []).filter((bq) =>
      !q || bq.questionText.toLowerCase().includes(q) || (bq.topic ?? "").toLowerCase().includes(q)
    )
  }, [bankQuestions.data, search])

  const totalMarks = useMemo(() => {
    return (bankQuestions.data ?? [])
      .filter((q) => form.selectedQuestionIds.includes(entityId(q)))
      .reduce((s, q) => s + (q.marks ?? 0), 0)
  }, [bankQuestions.data, form.selectedQuestionIds])

  function toggleAll() {
    const all = displayed.map(entityId)
    const allSel = all.every((id) => form.selectedQuestionIds.includes(id))
    if (allSel) {
      patch({ selectedQuestionIds: form.selectedQuestionIds.filter((id) => !all.includes(id)) })
    } else {
      patch({ selectedQuestionIds: Array.from(new Set([...form.selectedQuestionIds, ...all])) })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the questions for this exam.</p>
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <Field>
          <FieldLabel>Question bank</FieldLabel>
          {banks.isPending ? <Skeleton className="h-9 rounded-md" /> : (
            <select
              value={form.questionBankId}
              onChange={(e) => patch({ questionBankId: e.target.value, selectedQuestionIds: [] })}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
            >
              <option value="">Select a question bank…</option>
              {banks.data?.map((b) => (
                <option key={entityId(b)} value={entityId(b)}>{b.title} ({b.questionCount ?? 0} questions)</option>
              ))}
            </select>
          )}
        </Field>

        {bankId && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-50">
                <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="pl-9" />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <IconX className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{form.selectedQuestionIds.length} selected · {totalMarks} marks</span>
                <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {displayed.every((q) => form.selectedQuestionIds.includes(entityId(q))) ? "Deselect all" : "Select all"}
                </button>
              </div>
            </div>

            {bankQuestions.isPending ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : displayed.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No questions found.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-2">
                {displayed.map((q) => {
                  const id = entityId(q)
                  const isSelected = form.selectedQuestionIds.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const cur = form.selectedQuestionIds
                        patch({ selectedQuestionIds: isSelected ? cur.filter((x) => x !== id) : [...cur, id] })
                      }}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {isSelected && <IconCheck className="size-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug line-clamp-2">{q.questionText}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{q.questionType.replace(/_/g, " ")} · {q.marks} pt{q.marks === 1 ? "" : "s"}{q.topic ? ` · ${q.topic}` : ""}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {!bankId && !banks.isPending && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <IconClipboardList className="mb-2 size-8 opacity-30" />
            Select a question bank above to browse and pick questions.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Access ───────────────────────────────────────────────────────────

function EditStepAccess({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Access Control</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose who can access this exam and when.</p>
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium">Access mode</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { value: "PUBLIC_LINK_WITH_CODE" as AccessType, icon: <IconWorld className="size-5" />, title: "Public exam", desc: "Candidates enter the AR exam code, fill your required form, and start immediately." },
              { value: "LOGIN_REQUIRED_WITH_CODE" as AccessType, icon: <IconLock className="size-5" />, title: "Verified private exam", desc: "Candidates enter the AR exam code, verify an approved email by OTP, then complete your form." },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ accessType: opt.value })}
                className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${form.accessType === opt.value ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "hover:border-border hover:bg-muted/30"}`}
              >
                <div className={`flex size-9 items-center justify-center rounded-lg ${form.accessType === opt.value ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"}`}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {form.accessType === opt.value && (
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    <IconCheck className="size-3.5" /> Selected
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium">Availability</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { value: "ALWAYS_OPEN" as AvailabilityMode, title: "Always open", desc: "Available as soon as published." },
              { value: "SCHEDULED" as AvailabilityMode, title: "Scheduled", desc: "Set a start and end date/time window." },
              { value: "CLOSED_MANUALLY" as AvailabilityMode, title: "Manual close", desc: "You control when to open and close." },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ availabilityMode: opt.value })}
                className={`rounded-xl border p-4 text-left transition-all ${form.availabilityMode === opt.value ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "hover:border-border hover:bg-muted/30"}`}
              >
                <p className="text-sm font-medium">{opt.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {form.availabilityMode === "SCHEDULED" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${uid}-start`}>Start date & time</FieldLabel>
              <Input id={`${uid}-start`} type="datetime-local" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-end`}>End date & time</FieldLabel>
              <Input id={`${uid}-end`} type="datetime-local" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

function EditStepCandidateDetails({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const requirements = form.candidateIdentityRequirements

  function patchRequirements(partial: Partial<CandidateIdentityRequirements>) {
    patch({
      candidateIdentityRequirements: {
        ...requirements,
        ...partial,
      },
    })
  }

  function updateCustomField(index: number, partial: Partial<CandidateCustomField>) {
    patchRequirements({
      customFields: requirements.customFields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...partial } : field
      ),
    })
  }

  function addCustomField() {
    patchRequirements({
      customFields: [
        ...requirements.customFields,
        { key: "", label: "", type: "text", placeholder: "", required: false },
      ],
    })
  }

  function removeCustomField(index: number) {
    patchRequirements({
      customFields: requirements.customFields.filter((_, fieldIndex) => fieldIndex !== index),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Candidate Details Form</h2>
        <p className="mt-1 text-sm text-muted-foreground">Control exactly what candidates must submit before the exam session starts.</p>
      </div>

      <div className="rounded-xl border bg-card">
        <SettingRow title="Full name" desc="Ask for the candidate's full name before the exam starts." checked={requirements.fullName} onChange={(value) => patchRequirements({ fullName: value })} />
        <SettingRow title="Email address" desc="Collect the candidate email. Verified private exams lock this to the approved email after OTP." checked={requirements.email} onChange={(value) => patchRequirements({ email: value })} />
        <SettingRow title="Phone number" desc="Request a phone contact before the attempt begins." checked={requirements.phone} onChange={(value) => patchRequirements({ phone: value })} />
        <SettingRow title="Student or applicant ID" desc="Require a matric number, applicant number, or another institutional ID." checked={requirements.identifier} onChange={(value) => patchRequirements({ identifier: value })} />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Custom fields</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add extra questions like department, faculty, level, or campus.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
            <IconUsers className="size-4" />
            Add field
          </Button>
        </div>

        {requirements.customFields.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No custom fields yet. Add one if this exam needs extra candidate information.
          </div>
        ) : (
          <div className="space-y-4">
            {requirements.customFields.map((field, index) => (
              <div key={`${field.key || "field"}-${index}`} className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Custom field {index + 1}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomField(index)}>
                    <IconX className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Field label</FieldLabel>
                    <Input value={field.label} onChange={(event) => updateCustomField(index, { label: event.target.value })} placeholder="e.g. Department" />
                  </Field>
                  <Field>
                    <FieldLabel>Field key</FieldLabel>
                    <Input value={field.key} onChange={(event) => updateCustomField(index, { key: event.target.value.replace(/\s+/g, "") })} placeholder="e.g. department" />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Input type</FieldLabel>
                    <select
                      value={field.type}
                      onChange={(event) => updateCustomField(index, { type: event.target.value as CandidateFieldType })}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Placeholder</FieldLabel>
                    <Input value={field.placeholder} onChange={(event) => updateCustomField(index, { placeholder: event.target.value })} placeholder="e.g. Faculty of Science" />
                  </Field>
                </div>
                <SettingRow title="Required field" desc="Candidates must complete this field before they can continue." checked={field.required} onChange={(value) => updateCustomField(index, { required: value })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 5: Settings ─────────────────────────────────────────────────────────

function EditStepSettings({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Exam Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure randomization, results, and attempt limits.</p>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        <SettingRow title="Randomize question order" desc="Questions are presented in random order." checked={form.randomizeQuestions} onChange={(v) => patch({ randomizeQuestions: v })} />
        <SettingRow title="Randomize option order" desc="Answer choices are shuffled per candidate." checked={form.randomizeOptions} onChange={(v) => patch({ randomizeOptions: v })} />
        <SettingRow title="Show result immediately" desc="Candidates see their score right after submitting." checked={form.showResultImmediately} onChange={(v) => patch({ showResultImmediately: v })} />
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Max attempts per candidate</p>
            <p className="mt-0.5 text-xs text-muted-foreground">How many times a candidate can attempt this exam.</p>
          </div>
          <Input
            id={`${uid}-max`}
            type="number"
            min={1}
            max={10}
            value={form.maxAttempts}
            onChange={(e) => patch({ maxAttempts: e.target.value })}
            className="w-20 text-center"
          />
        </div>
      </div>
    </div>
  )
}

function SettingRow({ title, desc, checked, onChange }: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Step 5: Anti-Cheat ───────────────────────────────────────────────────────

function EditStepAntiCheat({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  function patchAC(partial: Partial<AntiCheatSettings>) {
    patch({ antiCheat: { ...form.antiCheat, ...partial } })
  }
  const ac = form.antiCheat

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Anti-Cheat Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure browser controls, session restrictions, and auto-submit thresholds.</p>
      </div>

      <ACGroup title="Browser Control" desc="Restrict what candidates can do in the browser.">
        <ACRow label="Require fullscreen" desc="Must be in fullscreen to take the exam." checked={!!ac.requireFullscreen} onChange={(v) => patchAC({ requireFullscreen: v })} />
        <ACRow label="Disable right-click" desc="Prevents the context menu." checked={!!ac.disableRightClick} onChange={(v) => patchAC({ disableRightClick: v })} />
        <ACRow label="Disable copy/paste" desc="Blocks copy, cut, and paste shortcuts." checked={!!ac.disableCopyPaste} onChange={(v) => patchAC({ disableCopyPaste: v })} />
        <ACRow label="Block DevTools shortcuts" desc="Blocks F12 and inspector shortcuts." checked={!!ac.blockDevToolsShortcuts} onChange={(v) => patchAC({ blockDevToolsShortcuts: v })} />
      </ACGroup>

      <ACGroup title="Session Control" desc="Detect suspicious session activity.">
        <ACRow label="Detect tab switching" desc="Log when the candidate switches tabs." checked={!!ac.detectTabSwitch} onChange={(v) => patchAC({ detectTabSwitch: v })} />
        <ACRow label="Detect window blur" desc="Log when the exam window loses focus." checked={!!ac.detectWindowBlur} onChange={(v) => patchAC({ detectWindowBlur: v })} />
        <ACRow label="Prevent multiple sessions" desc="Block opening the exam in multiple tabs." checked={!!ac.preventMultipleSessions} onChange={(v) => patchAC({ preventMultipleSessions: v })} />
      </ACGroup>

      <ACGroup title="Auto-Submit Rules" desc="Automatically submit on threshold breach.">
        <div className="grid gap-4 px-5 pb-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Max tab switches</FieldLabel>
            <Input type="number" min={1} value={ac.maxTabSwitches ?? 3} onChange={(e) => patchAC({ maxTabSwitches: Number(e.target.value) })} />
          </Field>
          <Field>
            <FieldLabel>Max fullscreen exits</FieldLabel>
            <Input type="number" min={1} value={ac.maxFullscreenExits ?? 3} onChange={(e) => patchAC({ maxFullscreenExits: Number(e.target.value) })} />
          </Field>
          <Field>
            <FieldLabel>Auto-submit score</FieldLabel>
            <Input type="number" min={1} value={ac.autoSubmitViolationScore ?? 100} onChange={(e) => patchAC({ autoSubmitViolationScore: Number(e.target.value) })} />
          </Field>
        </div>
      </ACGroup>

      <ACGroup title="Optional Monitoring" desc="Enhanced proctoring features.">
        <ACRow label="Require webcam" desc="Candidate must grant camera access." checked={!!ac.requireWebcam} onChange={(v) => patchAC({ requireWebcam: v })} />
        <ACRow label="Capture snapshots" desc="Periodic webcam photos." checked={!!ac.captureSnapshots} onChange={(v) => patchAC({ captureSnapshots: v })} />
        <ACRow label="Capture screenshots" desc="Periodic screen captures." checked={!!ac.captureScreenshots} onChange={(v) => patchAC({ captureScreenshots: v })} />
      </ACGroup>
    </div>
  )
}

function ACGroup({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b bg-muted/30 px-5 py-3.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function ACRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-3.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Step 6: Review ───────────────────────────────────────────────────────────

function EditStepReview({ form, onSave, isPending }: {
  form: FormState; onSave: () => void; isPending: boolean
}) {
  const issues: string[] = []
  if (!form.title.trim()) issues.push("Exam title is required.")
  if (!form.instructions.trim()) issues.push("Instructions are required.")
  if (!form.selectedQuestionIds.length) issues.push("No questions selected.")
  if (!Number(form.durationMinutes)) issues.push("Duration must be greater than 0.")
  if (form.availabilityMode === "SCHEDULED" && (!form.startTime || !form.endTime)) issues.push("Scheduled mode requires both start and end times.")
  if (form.candidateIdentityRequirements.customFields.some((field) => !field.key.trim() || !field.label.trim())) issues.push("Every custom candidate field needs both a label and a key.")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review Changes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review your updated exam configuration before saving.</p>
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <IconAlertTriangle className="size-4" />
            Please fix the following before saving:
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive/80">
            {issues.map((i) => <li key={i} className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">•</span>{i}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <ReviewSection title="Basic Info">
          <ReviewRow label="Title" value={form.title || "—"} />
          <ReviewRow label="Duration" value={`${form.durationMinutes} minutes`} />
          {form.passMark && <ReviewRow label="Pass mark" value={form.passMark} />}
        </ReviewSection>
        <ReviewSection title="Questions">
          <ReviewRow label="Selected" value={`${form.selectedQuestionIds.length} question${form.selectedQuestionIds.length === 1 ? "" : "s"}`} />
        </ReviewSection>
        <ReviewSection title="Access">
          <ReviewRow label="Access mode" value={{ PUBLIC_LINK_WITH_CODE: "Public exam", LOGIN_REQUIRED_WITH_CODE: "Verified private exam" }[form.accessType]} />
          <ReviewRow label="Availability" value={{ ALWAYS_OPEN: "Always open", SCHEDULED: "Scheduled", CLOSED_MANUALLY: "Manual close" }[form.availabilityMode]} />
        </ReviewSection>
        <ReviewSection title="Candidate Form">
          <ReviewRow label="Required built-in fields" value={summarizeCandidateRequirements(form.candidateIdentityRequirements)} />
          <ReviewRow label="Custom fields" value={form.candidateIdentityRequirements.customFields.length} />
        </ReviewSection>
        <ReviewSection title="Settings">
          <ReviewRow label="Randomize questions" value={form.randomizeQuestions ? "Yes" : "No"} />
          <ReviewRow label="Show result immediately" value={form.showResultImmediately ? "Yes" : "No"} />
          <ReviewRow label="Max attempts" value={form.maxAttempts} />
        </ReviewSection>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={isPending || issues.length > 0}
          onClick={onSave}
          className="gap-2"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/30 px-5 py-3">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function summarizeCandidateRequirements(requirements: CandidateIdentityRequirements) {
  const fields = [
    requirements.fullName ? "Full name" : null,
    requirements.email ? "Email" : null,
    requirements.phone ? "Phone" : null,
    requirements.identifier ? "ID number" : null,
  ].filter(Boolean)

  return fields.length > 0 ? fields.join(", ") : "No built-in fields"
}

function ReviewRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
