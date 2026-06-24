"use client"

import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconEye,
  IconFileText,
  IconLock,
  IconMenu2,
  IconPlus,
  IconRocket,
  IconSearch,
  IconSettings,
  IconShield,
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
import type { AntiCheatSettings, Question, QuestionBank } from "@/lib/api/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessType = "PUBLIC_LINK_WITH_CODE" | "LOGIN_REQUIRED_WITH_CODE"
type AvailabilityMode = "ALWAYS_OPEN" | "SCHEDULED" | "CLOSED_MANUALLY"
type CandidateFieldType = "text" | "email" | "tel" | "number"
type CandidateCustomField = { key: string; label: string; type: CandidateFieldType; placeholder: string; required: boolean }
type CandidateIdentityRequirements = { fullName: boolean; email: boolean; phone: boolean; identifier: boolean; customFields: CandidateCustomField[] }

type FormState = {
  title: string; description: string; instructions: string
  durationMinutes: string; passMark: string
  questionBankId: string; selectedQuestionIds: string[]
  accessType: AccessType; availabilityMode: AvailabilityMode
  startTime: string; endTime: string
  candidateIdentityRequirements: CandidateIdentityRequirements
  randomizeQuestions: boolean; randomizeOptions: boolean
  showResultImmediately: boolean; maxAttempts: string
  antiCheat: AntiCheatSettings; publishImmediately: boolean
}

const defaultCandidateRequirements: CandidateIdentityRequirements = {
  fullName: true, email: true, phone: false, identifier: false, customFields: [],
}

const defaultAntiCheat: AntiCheatSettings = {
  requireFullscreen: true, detectTabSwitch: true, detectWindowBlur: true,
  disableRightClick: true, disableCopyPaste: true, blockDevToolsShortcuts: true,
  preventMultipleSessions: true, requireWebcam: false, captureSnapshots: false,
  captureScreenshots: false, maxTabSwitches: 3, maxFullscreenExits: 3,
  autoSubmitViolationScore: 100, warningViolationScore: 30, finalWarningViolationScore: 70,
}

const defaultForm: FormState = {
  title: "", description: "", instructions: "",
  durationMinutes: "60", passMark: "",
  questionBankId: "", selectedQuestionIds: [],
  accessType: "PUBLIC_LINK_WITH_CODE", availabilityMode: "ALWAYS_OPEN",
  startTime: "", endTime: "",
  candidateIdentityRequirements: defaultCandidateRequirements,
  randomizeQuestions: true, randomizeOptions: false,
  showResultImmediately: true, maxAttempts: "1",
  antiCheat: defaultAntiCheat, publishImmediately: false,
}

const positiveAntiCheatFields: Array<keyof AntiCheatSettings> = [
  "snapshotIntervalSeconds",
  "screenshotIntervalSeconds",
  "autoSubmitViolationScore",
  "warningViolationScore",
  "finalWarningViolationScore",
  "maxAwaySeconds",
]

const nonNegativeAntiCheatFields: Array<keyof AntiCheatSettings> = [
  "maxTabSwitches",
  "maxFullscreenExits",
  "maxWindowBlurEvents",
  "maxRefreshAttempts",
]

function cleanAntiCheatSettings(settings: AntiCheatSettings) {
  const cleaned: AntiCheatSettings = { ...settings }
  for (const key of positiveAntiCheatFields) {
    const value = cleaned[key]
    if (value == null) continue
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue) || numberValue <= 0) delete cleaned[key]
    else cleaned[key] = numberValue as never
  }
  for (const key of nonNegativeAntiCheatFields) {
    const value = cleaned[key]
    if (value == null) continue
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue) || numberValue < 0) delete cleaned[key]
    else cleaned[key] = numberValue as never
  }
  return cleaned
}

function apiErrorDescription(error: ApiRequestError) {
  const messages = error.details
    .map((detail) => {
      const field = typeof detail.field === "string" ? detail.field : ""
      const message = typeof detail.message === "string" ? detail.message : ""
      if (field && message) return `${field}: ${message}`
      return message || field
    })
    .filter(Boolean)
  return messages.length ? messages.join("\n") : undefined
}

// ─── Step config ──────────────────────────────────────────────────────────────

type StepDef = { id: number; label: string; sublabel: string; icon: React.ReactNode }

const STEPS: StepDef[] = [
  { id: 1, label: "Basic Info",     sublabel: "Title, description & duration", icon: <IconFileText     className="size-4" /> },
  { id: 2, label: "Questions",      sublabel: "Pick from your question bank",  icon: <IconClipboardList className="size-4" /> },
  { id: 3, label: "Access",         sublabel: "Who can access & when",         icon: <IconWorld         className="size-4" /> },
  { id: 4, label: "Candidate Form", sublabel: "Details collected before start",icon: <IconUsers         className="size-4" /> },
  { id: 5, label: "Settings",       sublabel: "Randomization & attempt limits",icon: <IconSettings      className="size-4" /> },
  { id: 6, label: "Anti-Cheat",     sublabel: "Proctoring & violation rules",  icon: <IconShield        className="size-4" /> },
  { id: 7, label: "Review",         sublabel: "Confirm and create",            icon: <IconEye           className="size-4" /> },
]

// ─── ExamCreate ───────────────────────────────────────────────────────────────

export function ExamCreate() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function patch(partial: Partial<FormState>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const created = await apiRequest<{ id?: string; _id?: string }>("/exams", { method: "POST", body: JSON.stringify(body) })
      const examId = entityId(created.data)
      if (form.publishImmediately) await apiRequest(`/exams/${examId}/publish`, { method: "POST" })
      return { ...created, data: { ...created.data, id: examId } }
    },
    onSuccess: (res) => {
      toast.success(form.publishImmediately ? "Exam created and published." : "Exam created as draft.")
      router.push(`/examiner/exams/${entityId(res.data)}`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message, {
      description: apiErrorDescription(e),
    }),
  })

  function buildPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      instructions: form.instructions.trim() || undefined,
      durationMinutes: Number(form.durationMinutes),
      passMark: form.passMark ? Number(form.passMark) : undefined,
      questionBank: form.questionBankId,
      questions: form.selectedQuestionIds,
      accessType: form.accessType,
      availabilityMode: form.availabilityMode,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      candidateIdentityRequirements: {
        ...form.candidateIdentityRequirements,
        customFields: form.candidateIdentityRequirements.customFields.map((f) => ({
          key: f.key.trim(), label: f.label.trim(), type: f.type,
          placeholder: f.placeholder.trim(), required: f.required,
        })),
      },
      randomizeQuestions: form.randomizeQuestions,
      randomizeOptions: form.randomizeOptions,
      showResultImmediately: form.showResultImmediately,
      maxAttempts: Number(form.maxAttempts) || 1,
      maxAttemptsPerCandidate: Number(form.maxAttempts) || 1,
      antiCheatSettings: cleanAntiCheatSettings(form.antiCheat),
    }
  }

  function handleSubmit() {
    if (!form.title.trim()) { toast.error("Exam title is required."); setStep(1); return }
    if (!form.instructions.trim()) { toast.error("Instructions are required."); setStep(1); return }
    if (form.publishImmediately && !form.passMark) { toast.error("Pass mark is required before publishing."); setStep(1); return }
    if (!form.questionBankId) { toast.error("Select a question bank."); setStep(2); return }
    if (!form.selectedQuestionIds.length) { toast.error("Select at least one question."); setStep(2); return }
    if (form.candidateIdentityRequirements.customFields.some((f) => !f.key.trim() || !f.label.trim())) {
      toast.error("All custom fields need a label and key."); setStep(4); return
    }
    createMutation.mutate(buildPayload())
  }

  const canNext = useMemo(() => {
    if (step === 1) return form.title.trim().length > 0 && form.instructions.trim().length > 0 && Number(form.durationMinutes) > 0
    if (step === 2) return Boolean(form.questionBankId) && form.selectedQuestionIds.length > 0
    return true
  }, [step, form])

  const completedSteps = useMemo<Set<number>>(() => {
    const c = new Set<number>()
    if (form.title.trim() && form.instructions.trim() && Number(form.durationMinutes) > 0) c.add(1)
    if (form.questionBankId && form.selectedQuestionIds.length > 0) c.add(2)
    if (form.accessType) c.add(3)
    c.add(4); c.add(5); c.add(6)
    return c
  }, [form])

  const curStep = STEPS.find((s) => s.id === step)!

  return (
    <div className="flex min-h-full flex-col bg-[#f8f9fc] dark:bg-background">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur dark:bg-card/95 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/examiner/exams")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <IconArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to Exams</span>
        </button>

        <div className="h-4 w-px bg-border" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {form.title.trim() || "New Exam"}
          </p>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Step {step} of {STEPS.length} — {curStep.label}
          </p>
        </div>

        {/* Mobile: step counter + drawer toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {step} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
          >
            <IconMenu2 className="size-4" />
          </button>
        </div>

        {/* Desktop: compact step pills */}
        <div className="hidden items-center gap-1 lg:flex">
          {STEPS.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1">
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                s.id === step        ? "bg-primary text-primary-foreground shadow-sm" :
                completedSteps.has(s.id) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                                      "bg-muted text-muted-foreground"
              }`}>
                {completedSteps.has(s.id) && s.id !== step ? <IconCheck className="size-3" /> : s.id}
              </span>
              {i < STEPS.length - 1 && <IconChevronRight className="size-3 text-muted-foreground/30" />}
            </span>
          ))}
        </div>
      </header>

      {/* ── Mobile step drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <nav
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-2xl dark:bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="text-sm font-semibold">Steps</p>
              <button type="button" onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <IconX className="size-4" />
              </button>
            </div>
            <div className="p-3 space-y-0.5">
              {STEPS.map((s) => (
                <StepItem
                  key={s.id}
                  step={s}
                  active={step === s.id}
                  completed={completedSteps.has(s.id)}
                  reachable={s.id <= step || completedSteps.has(s.id)}
                  onClick={() => { setStep(s.id); setSidebarOpen(false) }}
                />
              ))}
            </div>
            <div className="border-t p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{completedSteps.size} / {STEPS.length} complete</span>
                <span>{Math.round((completedSteps.size / STEPS.length) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(completedSteps.size / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden w-64 shrink-0 border-r bg-white dark:bg-card lg:flex lg:flex-col xl:w-72">
          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Steps
            </p>
            <div className="space-y-0.5">
              {STEPS.map((s) => (
                <StepItem
                  key={s.id}
                  step={s}
                  active={step === s.id}
                  completed={completedSteps.has(s.id)}
                  reachable={s.id <= step || completedSteps.has(s.id)}
                  onClick={() => setStep(s.id)}
                />
              ))}
            </div>

            <div className="mt-5 px-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{completedSteps.size} of {STEPS.length} complete</span>
                <span>{Math.round((completedSteps.size / STEPS.length) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(completedSteps.size / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Step header band */}
          <div className="shrink-0 border-b bg-white px-4 py-4 dark:bg-card sm:px-8">
            <div className="mx-auto w-full max-w-4xl flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-primary">{curStep.icon}</span>
              </div>
              <div>
                <h1 className="text-base font-semibold sm:text-lg">{curStep.label}</h1>
                <p className="text-xs text-muted-foreground sm:text-sm">{curStep.sublabel}</p>
              </div>
            </div>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {step === 1 && <StepBasicInfo form={form} patch={patch} />}
              {step === 2 && <StepQuestions form={form} patch={patch} />}
              {step === 3 && <StepAccess form={form} patch={patch} />}
              {step === 4 && <StepCandidateDetails form={form} patch={patch} />}
              {step === 5 && <StepSettings form={form} patch={patch} />}
              {step === 6 && <StepAntiCheat form={form} patch={patch} />}
              {step === 7 && <StepReview form={form} patch={patch} onSubmit={handleSubmit} isPending={createMutation.isPending} />}
              {/* bottom breathing room */}
              <div className="h-4" />
            </div>
          </div>

          {/* ── Sticky footer nav ── */}
          {step < STEPS.length && (
            <div className="shrink-0 border-t bg-white/95 px-4 py-3 backdrop-blur dark:bg-card/95 sm:px-8">
              <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
                <Button
                  variant="outline"
                  disabled={step === 1}
                  onClick={() => setStep((s) => s - 1)}
                  className="gap-1.5"
                >
                  <IconArrowLeft className="size-4" />
                  Previous
                </Button>

                {/* Dot indicators (all screen sizes) */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => (s.id <= step || completedSteps.has(s.id)) && setStep(s.id)}
                      className={`rounded-full transition-all duration-200 ${
                        s.id === step            ? "h-2 w-5 bg-primary" :
                        completedSteps.has(s.id) ? "size-2 bg-emerald-500 cursor-pointer" :
                                                   "size-2 bg-muted-foreground/25"
                      }`}
                    />
                  ))}
                </div>

                <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="gap-1.5">
                  Next
                  <IconArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Sidebar step item ────────────────────────────────────────────────────────

function StepItem({ step, active, completed, reachable, onClick }: {
  step: StepDef; active: boolean; completed: boolean; reachable: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={reachable ? onClick : undefined}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
        active    ? "bg-primary/8 ring-1 ring-primary/20" :
        reachable ? "hover:bg-muted/60 cursor-pointer" :
                    "cursor-default opacity-40"
      }`}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all ${
        active    ? "bg-primary text-primary-foreground shadow-sm" :
        completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                    "bg-muted/70 text-muted-foreground"
      }`}>
        {completed && !active ? <IconCheck className="size-3.5" /> : step.id}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium leading-tight ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
          {step.label}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{step.sublabel}</p>
      </div>
      {active && <IconChevronRight className="size-3.5 shrink-0 text-primary" />}
    </button>
  )
}

// ─── Step 1: Basic Info ───────────────────────────────────────────────────────

function StepBasicInfo({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()
  return (
    <div className="space-y-4">
      <Card>
        <CardSection>
          <Field>
            <FieldLabel htmlFor={`${uid}-title`}>Exam title <Req /></FieldLabel>
            <Input
              id={`${uid}-title`}
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Mathematics Mid-Term 2025"
              maxLength={120}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Shown to candidates on the exam landing page.</p>
          </Field>
        </CardSection>
        <CardSection>
          <Field>
            <FieldLabel htmlFor={`${uid}-desc`}>Description <Opt /></FieldLabel>
            <Textarea
              id={`${uid}-desc`}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Brief overview visible to candidates before they start."
              rows={3}
            />
          </Field>
        </CardSection>
        <CardSection>
          <Field>
            <FieldLabel htmlFor={`${uid}-inst`}>Instructions <span className="text-destructive">*</span></FieldLabel>
            <Textarea
              id={`${uid}-inst`}
              value={form.instructions}
              onChange={(e) => patch({ instructions: e.target.value })}
              placeholder="Shown on the start page just before the exam begins."
              rows={4}
            />
          </Field>
        </CardSection>
        <CardSection noBorder>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${uid}-dur`}>Duration <Req /></FieldLabel>
              <div className="relative">
                <Input
                  id={`${uid}-dur`}
                  type="number"
                  min={1}
                  max={600}
                  value={form.durationMinutes}
                  onChange={(e) => patch({ durationMinutes: e.target.value })}
                  className="pr-20"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  minutes
                </span>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-pass`}>Pass mark <span className="ml-1 text-xs font-normal text-muted-foreground">(required before publish)</span></FieldLabel>
              <div className="relative">
                <Input
                  id={`${uid}-pass`}
                  type="number"
                  min={0}
                  value={form.passMark}
                  onChange={(e) => patch({ passMark: e.target.value })}
                  placeholder="e.g. 50"
                />
              </div>
            </Field>
          </div>
        </CardSection>
      </Card>
    </div>
  )
}

// ─── Step 2: Questions ────────────────────────────────────────────────────────

function StepQuestions({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const [search, setSearch] = useState("")

  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => apiRequest<QuestionBank[]>("/question-banks?limit=100").then((r) => r.data),
  })
  const activeBanks = useMemo(() => (banks.data ?? []).filter((bank) => bank.status === "ACTIVE"), [banks.data])

  const bankId = form.questionBankId
  const bankQuestions = useQuery({
    queryKey: ["question-bank", bankId, "questions", "active"],
    queryFn: () => apiRequest<Question[]>(`/question-banks/${bankId}/questions?limit=500&status=ACTIVE`).then((r) => r.data),
    enabled: Boolean(bankId),
  })

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    return (bankQuestions.data ?? []).filter((bq) =>
      !q || bq.questionText.toLowerCase().includes(q) || (bq.topic ?? "").toLowerCase().includes(q)
    )
  }, [bankQuestions.data, search])

  const totalMarks = useMemo(() =>
    (bankQuestions.data ?? [])
      .filter((q) => form.selectedQuestionIds.includes(entityId(q)))
      .reduce((s, q) => s + (q.marks ?? 0), 0),
    [bankQuestions.data, form.selectedQuestionIds]
  )

  function toggleAll() {
    const all = displayed.map(entityId)
    if (!all.length) return
    const allSelected = all.every((id) => form.selectedQuestionIds.includes(id))
    if (allSelected) patch({ selectedQuestionIds: form.selectedQuestionIds.filter((id) => !all.includes(id)) })
    else patch({ selectedQuestionIds: Array.from(new Set([...form.selectedQuestionIds, ...all])) })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardSection>
          <Field>
            <FieldLabel>Question bank <Req /></FieldLabel>
            {banks.isPending ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <div className="relative">
                <select
                  value={form.questionBankId}
                  onChange={(e) => patch({ questionBankId: e.target.value, selectedQuestionIds: [] })}
                  className="h-9 w-full appearance-none rounded-md border bg-background pl-3 pr-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                >
                  <option value="">Select a question bank…</option>
                  {activeBanks.map((b) => (
                    <option key={entityId(b)} value={entityId(b)}>{b.title} ({b.questionCount ?? 0} questions)</option>
                  ))}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
            {!banks.isPending && activeBanks.length === 0 && (
              <p className="mt-2 text-xs text-destructive">Create an active question bank with questions before creating an exam.</p>
            )}
          </Field>
        </CardSection>

        {bankId ? (
          <>
            <CardSection>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="pl-9 pr-9" />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <IconX className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 text-sm sm:justify-start">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{form.selectedQuestionIds.length}</strong> selected
                    {totalMarks > 0 && <span> · <strong className="text-foreground">{totalMarks}</strong> marks</span>}
                  </span>
                  <button type="button" onClick={toggleAll} disabled={displayed.length === 0} className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground">
                    {displayed.length > 0 && displayed.every((q) => form.selectedQuestionIds.includes(entityId(q))) ? "Deselect all" : "Select all"}
                  </button>
                </div>
              </div>
            </CardSection>

            <div className="border-t">
              {bankQuestions.isPending ? (
                <div className="divide-y">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-none" />)}
                </div>
              ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconSearch className="mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No questions match your search.</p>
                </div>
              ) : (
                <div className="max-h-[400px] divide-y overflow-y-auto">
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
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                          isSelected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}>
                          {isSelected && <IconCheck className="size-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug line-clamp-2">{q.questionText}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.questionType.replace(/_/g, " ")}
                            {q.marks != null && <> · <strong>{q.marks}</strong> pt{q.marks === 1 ? "" : "s"}</>}
                            {q.topic && <> · {q.topic}</>}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          !banks.isPending && (
            <CardSection noBorder>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60">
                  <IconClipboardList className="size-6 text-muted-foreground/50" />
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">Select a question bank above</p>
                <p className="mt-1 text-xs text-muted-foreground">Your available questions will appear here.</p>
              </div>
            </CardSection>
          )
        )}
      </Card>

      {form.selectedQuestionIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <IconCheck className="size-4 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            <strong>{form.selectedQuestionIds.length}</strong> question{form.selectedQuestionIds.length === 1 ? "" : "s"} selected
            {totalMarks > 0 && <> · <strong>{totalMarks}</strong> total marks</>}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Access ───────────────────────────────────────────────────────────

function StepAccess({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()

  const accessOptions: { value: AccessType; icon: React.ReactNode; title: string; desc: string }[] = [
    { value: "PUBLIC_LINK_WITH_CODE", icon: <IconWorld className="size-5" />, title: "Public exam",
      desc: "Anyone with the AR code can complete the form and start. No email verification required." },
    { value: "LOGIN_REQUIRED_WITH_CODE", icon: <IconLock className="size-5" />, title: "Verified private exam",
      desc: "Candidates enter the AR code then verify an approved email via OTP before starting." },
  ]

  const availOptions: { value: AvailabilityMode; title: string; desc: string }[] = [
    { value: "ALWAYS_OPEN",     title: "Always open",  desc: "Available immediately after publishing." },
    { value: "SCHEDULED",       title: "Scheduled",    desc: "Opens and closes on your set dates." },
    { value: "CLOSED_MANUALLY", title: "Manual",       desc: "You open and close it from the control room." },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Access mode</p>
          <p className="mt-0.5 text-xs text-muted-foreground">How candidates authenticate to take this exam.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {accessOptions.map((opt) => {
            const active = form.accessType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ accessType: opt.value })}
                className={`relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                  active ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/20 hover:bg-muted/30"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <IconCheck className="size-3" />
                  </span>
                )}
                <div className={`flex size-9 items-center justify-center rounded-lg ${active ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"}`}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{opt.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Availability window</p>
          <p className="mt-0.5 text-xs text-muted-foreground">When candidates can access this exam.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {availOptions.map((opt) => {
            const active = form.availabilityMode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ availabilityMode: opt.value })}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  active ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/20 hover:bg-muted/30"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <IconCheck className="size-2.5" />
                  </span>
                )}
                <p className="text-sm font-semibold pr-5">{opt.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{opt.desc}</p>
              </button>
            )
          })}
        </div>
        {form.availabilityMode === "SCHEDULED" && (
          <div className="border-t px-4 pb-4 pt-3">
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
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Step 4: Candidate Details Form ──────────────────────────────────────────

function StepCandidateDetails({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const req = form.candidateIdentityRequirements

  function patchReq(partial: Partial<CandidateIdentityRequirements>) {
    patch({ candidateIdentityRequirements: { ...req, ...partial } })
  }
  function updateField(idx: number, partial: Partial<CandidateCustomField>) {
    patchReq({ customFields: req.customFields.map((f, i) => i === idx ? { ...f, ...partial } : f) })
  }
  function addField() {
    patchReq({ customFields: [...req.customFields, { key: "", label: "", type: "text", placeholder: "", required: false }] })
  }
  function removeField(idx: number) {
    patchReq({ customFields: req.customFields.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Built-in identity fields</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Toggle which standard fields candidates must complete before starting.</p>
        </div>
        <div className="divide-y">
          <SettingRow title="Full name" desc="Candidate's full legal or classroom name." checked={req.fullName} onChange={(v) => patchReq({ fullName: v })} />
          <SettingRow title="Email address" desc="Locked to the verified email on private exams." checked={req.email} onChange={(v) => patchReq({ email: v })} />
          <SettingRow title="Phone number" desc="A contact number before the attempt begins." checked={req.phone} onChange={(v) => patchReq({ phone: v })} />
          <SettingRow title="Student / applicant ID" desc="Matric number, application ID, or institutional code." checked={req.identifier} onChange={(v) => patchReq({ identifier: v })} />
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Custom fields</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Add extra fields like department, level, or campus.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addField} className="shrink-0">
            <IconPlus className="size-3.5" />
            Add field
          </Button>
        </div>

        {req.customFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
            <IconPlus className="mb-2 size-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No custom fields yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {req.customFields.map((field, idx) => (
              <div key={`${field.key || "f"}-${idx}`} className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Field {idx + 1}</p>
                  <button type="button" onClick={() => removeField(idx)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <IconX className="size-3.5" /> Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Label <Req /></FieldLabel>
                    <Input value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} placeholder="e.g. Department" />
                  </Field>
                  <Field>
                    <FieldLabel>Key <Req /></FieldLabel>
                    <Input value={field.key} onChange={(e) => updateField(idx, { key: e.target.value.replace(/\s+/g, "_") })} placeholder="e.g. department" className="font-mono text-sm" />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Input type</FieldLabel>
                    <div className="relative">
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value as CandidateFieldType })}
                        className="h-9 w-full appearance-none rounded-md border bg-background pl-3 pr-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="number">Number</option>
                      </select>
                      <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Placeholder <Opt /></FieldLabel>
                    <Input value={field.placeholder} onChange={(e) => updateField(idx, { placeholder: e.target.value })} placeholder="e.g. Faculty of Science" />
                  </Field>
                </div>
                <SettingRow title="Required field" desc="Candidate must fill this before the exam starts." checked={field.required} onChange={(v) => updateField(idx, { required: v })} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Step 5: Settings ─────────────────────────────────────────────────────────

function StepSettings({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const uid = useId()
  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Randomization</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Control the order candidates see questions and choices.</p>
        </div>
        <div className="divide-y">
          <SettingRow title="Randomize question order" desc="Each candidate gets a uniquely shuffled question sequence." checked={form.randomizeQuestions} onChange={(v) => patch({ randomizeQuestions: v })} />
          <SettingRow title="Randomize option order" desc="Answer choices are shuffled per question per candidate." checked={form.randomizeOptions} onChange={(v) => patch({ randomizeOptions: v })} />
        </div>
      </Card>

      <Card>
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Results & attempts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Configure what candidates see after submitting and how many tries they get.</p>
        </div>
        <div className="divide-y">
          <SettingRow title="Show result immediately" desc="Candidates see their score and pass/fail right after submitting." checked={form.showResultImmediately} onChange={(v) => patch({ showResultImmediately: v })} />
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium">Max attempts per candidate</p>
              <p className="mt-0.5 text-xs text-muted-foreground">How many times each candidate can attempt this exam.</p>
            </div>
            <Input
              id={`${uid}-max`}
              type="number"
              min={1}
              max={10}
              value={form.maxAttempts}
              onChange={(e) => patch({ maxAttempts: e.target.value })}
              className="w-20 shrink-0 text-center"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Step 6: Anti-Cheat ───────────────────────────────────────────────────────

function StepAntiCheat({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  function patchAC(partial: Partial<AntiCheatSettings>) {
    patch({ antiCheat: { ...form.antiCheat, ...partial } })
  }
  const ac = form.antiCheat

  return (
    <div className="space-y-4">
      <ACGroup title="Browser controls" desc="Restrict what candidates can do inside the browser.">
        <SettingRow label="Require fullscreen" desc="Candidate must stay in fullscreen throughout the exam." checked={!!ac.requireFullscreen} onChange={(v) => patchAC({ requireFullscreen: v })} />
        <SettingRow label="Disable right-click" desc="Blocks the context menu." checked={!!ac.disableRightClick} onChange={(v) => patchAC({ disableRightClick: v })} />
        <SettingRow label="Disable copy / paste" desc="Blocks Ctrl+C, Ctrl+V, and clipboard shortcuts." checked={!!ac.disableCopyPaste} onChange={(v) => patchAC({ disableCopyPaste: v })} />
        <SettingRow label="Block DevTools shortcuts" desc="Blocks F12 and Ctrl+Shift+I." checked={!!ac.blockDevToolsShortcuts} onChange={(v) => patchAC({ blockDevToolsShortcuts: v })} />
      </ACGroup>

      <ACGroup title="Session monitoring" desc="Detect and log suspicious activity.">
        <SettingRow label="Detect tab switching" desc="Logged when the candidate changes tabs or apps." checked={!!ac.detectTabSwitch} onChange={(v) => patchAC({ detectTabSwitch: v })} />
        <SettingRow label="Detect window blur" desc="Logged when the exam window loses focus." checked={!!ac.detectWindowBlur} onChange={(v) => patchAC({ detectWindowBlur: v })} />
        <SettingRow label="Prevent multiple sessions" desc="Blocks the same candidate opening the exam in two tabs." checked={!!ac.preventMultipleSessions} onChange={(v) => patchAC({ preventMultipleSessions: v })} />
      </ACGroup>

      <ACGroup title="Violation thresholds" desc="Auto-submit when limits are exceeded.">
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-3">
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

      <ACGroup title="Camera proctoring" desc="Enhanced monitoring with webcam (requires candidate permission).">
        <SettingRow label="Require webcam" desc="Camera access must be granted before the exam starts." checked={!!ac.requireWebcam} onChange={(v) => patchAC({ requireWebcam: v })} />
        <SettingRow label="Capture periodic snapshots" desc="Webcam photos taken at intervals during the attempt." checked={!!ac.captureSnapshots} onChange={(v) => patchAC({ captureSnapshots: v })} />
        <SettingRow label="Capture periodic screenshots" desc="Screen captures taken at intervals during the attempt." checked={!!ac.captureScreenshots} onChange={(v) => patchAC({ captureScreenshots: v })} />
      </ACGroup>
    </div>
  )
}

function ACGroup({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b px-5 py-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="divide-y">{children}</div>
    </Card>
  )
}

// ─── Step 7: Review & Publish ─────────────────────────────────────────────────

function StepReview({ form, patch, onSubmit, isPending }: {
  form: FormState; patch: (p: Partial<FormState>) => void; onSubmit: () => void; isPending: boolean
}) {
  const issues: string[] = []
  if (!form.title.trim()) issues.push("Exam title is required.")
  if (!form.instructions.trim()) issues.push("Instructions are required.")
  if (form.publishImmediately && !form.passMark) issues.push("Pass mark is required before publishing.")
  if (!form.questionBankId) issues.push("Question bank is required.")
  if (!form.selectedQuestionIds.length) issues.push("No questions selected.")
  if (!Number(form.durationMinutes)) issues.push("Duration must be greater than 0.")
  if (form.availabilityMode === "SCHEDULED" && (!form.startTime || !form.endTime)) issues.push("Scheduled mode requires both start and end times.")
  if (form.candidateIdentityRequirements.customFields.some((f) => !f.key.trim() || !f.label.trim())) issues.push("All custom fields need a label and key.")

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <IconAlertTriangle className="size-4 shrink-0" />
            Fix before creating
          </div>
          <ul className="mt-2 space-y-1">
            {issues.map((i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-destructive/80">
                <span className="mt-0.5 shrink-0">•</span>{i}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewCard title="Basic Info">
          <RR label="Title"    value={form.title || "—"} />
          <RR label="Duration" value={`${form.durationMinutes} min`} />
          {form.passMark && <RR label="Pass mark" value={`${form.passMark} pts`} />}
        </ReviewCard>
        <ReviewCard title="Questions">
          <RR label="Selected" value={`${form.selectedQuestionIds.length} question${form.selectedQuestionIds.length === 1 ? "" : "s"}`} />
        </ReviewCard>
        <ReviewCard title="Access">
          <RR label="Mode"         value={{ PUBLIC_LINK_WITH_CODE: "Public", LOGIN_REQUIRED_WITH_CODE: "Verified private" }[form.accessType]} />
          <RR label="Availability" value={{ ALWAYS_OPEN: "Always open", SCHEDULED: "Scheduled", CLOSED_MANUALLY: "Manual" }[form.availabilityMode]} />
        </ReviewCard>
        <ReviewCard title="Candidate Form">
          <RR label="Built-in fields" value={summarizeCandidateRequirements(form.candidateIdentityRequirements)} />
          <RR label="Custom fields"   value={form.candidateIdentityRequirements.customFields.length} />
        </ReviewCard>
        <ReviewCard title="Settings">
          <RR label="Randomize questions" value={form.randomizeQuestions ? "Yes" : "No"} />
          <RR label="Randomize options"   value={form.randomizeOptions   ? "Yes" : "No"} />
          <RR label="Show result"         value={form.showResultImmediately ? "Immediately" : "Hidden"} />
          <RR label="Max attempts"        value={form.maxAttempts} />
        </ReviewCard>
        <ReviewCard title="Anti-Cheat">
          <RR label="Fullscreen"    value={form.antiCheat.requireFullscreen   ? "Required" : "Off"} />
          <RR label="Tab detection" value={form.antiCheat.detectTabSwitch     ? "On"       : "Off"} />
          <RR label="Copy/paste"    value={form.antiCheat.disableCopyPaste    ? "Blocked"  : "Allowed"} />
          <RR label="Webcam"        value={form.antiCheat.requireWebcam       ? "Required" : "Off"} />
        </ReviewCard>
      </div>

      {/* Publish toggle */}
      <Card>
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <IconRocket className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Publish immediately</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {form.publishImmediately
                  ? "Exam goes live for candidates as soon as it's created."
                  : "Exam will be saved as a draft. Publish manually when ready."}
              </p>
            </div>
          </div>
          <Switch checked={form.publishImmediately} onCheckedChange={(v) => patch({ publishImmediately: v })} />
        </div>
      </Card>

      <Button
        size="lg"
        disabled={isPending || issues.length > 0}
        onClick={onSubmit}
        className="w-full gap-2 text-sm"
      >
        {isPending ? "Creating…" : form.publishImmediately ? "Create & Publish Exam" : "Create as Draft"}
      </Button>
    </div>
  )
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white dark:bg-card">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function RR({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function summarizeCandidateRequirements(req: CandidateIdentityRequirements) {
  const fields = [req.fullName && "Name", req.email && "Email", req.phone && "Phone", req.identifier && "ID"].filter(Boolean)
  return fields.length > 0 ? (fields as string[]).join(", ") : "None"
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-card">{children}</div>
}

function CardSection({ children, noBorder }: { children: React.ReactNode; noBorder?: boolean }) {
  return <div className={`px-5 py-5 ${!noBorder ? "border-b" : ""}`}>{children}</div>
}

function SettingRow({ title, label, desc, checked, onChange }: {
  title?: string; label?: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div>
        <p className="text-sm font-medium">{title ?? label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function Req() {
  return <span className="text-destructive"> *</span>
}
function Opt() {
  return <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
}
