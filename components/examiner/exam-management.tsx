"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  IconArrowRight,
  IconCopy,
  IconLink,
  IconLockShare,
  IconPlus,
  IconRocket,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError, apiRequest, currentUser } from "@/lib/api/client"
import type { Exam, ExamAccessInfo, Question, QuestionBank } from "@/lib/api/types"

const defaultAntiCheat = {
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
}

export function ExamManagement({ basePath = "/examiner/exams" }: { basePath?: string }) {
  const queryClient = useQueryClient()
  const { data: actor } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const canAuthor = actor?.role === "EXAMINER"
  const canOpenExam = canAuthor || Boolean(actor?.permissions.includes("VIEW_REPORTS"))
  const [bankId, setBankId] = useState("")
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [options, setOptions] = useState({ randomizeQuestions: false, randomizeOptions: false, showResultImmediately: false })
  const [antiCheat, setAntiCheat] = useState(defaultAntiCheat)
  const [customFields, setCustomFields] = useState<Array<{ key: string; label: string; type: "text" | "email" | "tel" | "number"; placeholder: string; required: boolean }>>([])
  const [archiving, setArchiving] = useState<Exam | null>(null)
  const [activeExamId, setActiveExamId] = useState("")

  const banks = useQuery({ queryKey: ["question-banks"], queryFn: () => apiRequest<QuestionBank[]>("/question-banks?limit=50").then((response) => response.data), enabled: Boolean(canAuthor) })
  const currentBankId = bankId || entityId(banks.data?.[0] ?? {})
  const questions = useQuery({
    queryKey: ["examiner", "questions", currentBankId],
    queryFn: () => apiRequest<Question[]>(`/questions?limit=100&questionBank=${currentBankId}`).then((response) => response.data),
    enabled: Boolean(canAuthor && currentBankId),
  })
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => apiRequest<Exam[]>("/exams?limit=50").then((response) => response.data) })
  const currentActiveExamId = activeExamId || entityId(exams.data?.[0] ?? {})
  const accessInfo = useQuery({
    queryKey: ["exam-access-info", currentActiveExamId],
    queryFn: () => apiRequest<ExamAccessInfo>(`/exams/${currentActiveExamId}/access-info`).then((response) => response.data),
    enabled: Boolean(currentActiveExamId),
  })
  const action = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: "POST" | "DELETE"; body?: object }) => apiRequest<Exam>(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: (_, variables) => {
      const message = variables.method === "DELETE"
        ? "Exam archived."
        : variables.path.endsWith("/publish")
          ? "Exam published."
          : variables.path.endsWith("/close")
            ? "Exam closed."
            : variables.path.endsWith("/regenerate-access-code")
              ? "Access code regenerated."
              : variables.path.endsWith("/regenerate-link")
                ? "Public link regenerated."
                : "Exam draft created."
      toast.success(message)
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      queryClient.invalidateQueries({ queryKey: ["exam-access-info"] })
      setSelectedQuestions([])
      setArchiving(null)
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  const sortedExams = useMemo(() => (exams.data ?? []).slice().sort((left, right) => new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() - new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()), [exams.data])
  const selectedExam = sortedExams.find((exam) => entityId(exam) === currentActiveExamId) ?? sortedExams[0]

  function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedQuestions.length) {
      toast.error("Select at least one question.")
      return
    }
    if (customFields.some((field) => !field.key.trim() || !field.label.trim())) {
      toast.error("Each additional candidate field needs a label and a field key.")
      return
    }
    const form = new FormData(event.currentTarget)
    action.mutate({
      path: "/exams",
      method: "POST",
      body: {
        title: String(form.get("title")),
        questionBank: String(form.get("questionBank")),
        description: String(form.get("description")),
        instructions: String(form.get("instructions")),
        durationMinutes: Number(form.get("durationMinutes")),
        availabilityMode: String(form.get("availabilityMode")),
        startTime: form.get("startTime") ? new Date(String(form.get("startTime"))).toISOString() : undefined,
        endTime: form.get("endTime") ? new Date(String(form.get("endTime"))).toISOString() : undefined,
        questions: selectedQuestions,
        passMark: Number(form.get("passMark")),
        randomizeQuestions: options.randomizeQuestions,
        randomizeOptions: options.randomizeOptions,
        showResultImmediately: options.showResultImmediately,
        maxAttempts: Number(form.get("maxAttempts")),
        maxAttemptsPerCandidate: Number(form.get("maxAttempts")),
        candidateIdentityRequirements: {
          fullName: true,
          email: true,
          phone: Boolean(form.get("requirePhone")),
          identifier: Boolean(form.get("requireIdentifier")),
          customFields,
        },
        antiCheatSettings: {
          ...antiCheat,
          snapshotIntervalSeconds: Number(form.get("snapshotIntervalSeconds")),
          screenshotIntervalSeconds: Number(form.get("screenshotIntervalSeconds")),
          maxTabSwitches: Number(form.get("maxTabSwitches")),
          maxFullscreenExits: Number(form.get("maxFullscreenExits")),
          maxWindowBlurEvents: Number(form.get("maxWindowBlurEvents")),
          maxRefreshAttempts: Number(form.get("maxRefreshAttempts")),
          autoSubmitViolationScore: Number(form.get("autoSubmitViolationScore")),
          warningViolationScore: Number(form.get("warningViolationScore")),
          finalWarningViolationScore: Number(form.get("finalWarningViolationScore")),
          maxAwaySeconds: Number(form.get("maxAwaySeconds")),
        },
      },
    })
    event.currentTarget.reset()
    setCustomFields([])
    setSelectedQuestions([])
    setOptions({ randomizeQuestions: false, randomizeOptions: false, showResultImmediately: false })
    setAntiCheat(defaultAntiCheat)
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading
        title="Examinations"
        description={canAuthor ? "Design, publish, and monitor secure assessments with clear candidate intake and anti-cheat controls." : "Review published examinations, access state, and integrity posture across the platform."}
        action={canAuthor ? <Button asChild><a href="#exam-builder"><IconPlus className="size-4" /> Create new exam</a></Button> : undefined}
      />

      <div className={`grid gap-4 px-4 lg:px-6 ${canAuthor ? "xl:grid-cols-[1.05fr_.95fr]" : ""}`}>
        {canAuthor ? (
          <div id="exam-builder" className="space-y-4">
            <Card className="border-border/70 bg-card/92 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IconPlus className="size-5" /> Create exam draft</CardTitle>
                <CardDescription>Build a professional exam in sections: identity, questions, candidate intake, anti-cheat settings, and publish readiness.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createExam} className="space-y-4">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Exam identity and visibility</CardTitle>
                      <CardDescription>Set the exam title, timing, and basic publishing window.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        <Field><FieldLabel>Title</FieldLabel><Input name="title" required /></Field>
                        <Field><FieldLabel>Description</FieldLabel><Input name="description" /></Field>
                        <Field><FieldLabel>Instructions</FieldLabel><Textarea name="instructions" placeholder="Rules candidates must review before starting." /></Field>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field><FieldLabel>Availability</FieldLabel><select name="availabilityMode" defaultValue="ALWAYS_OPEN" className="h-9 rounded-md border bg-background px-3 text-sm"><option value="ALWAYS_OPEN">Always open</option><option value="SCHEDULED">Scheduled</option></select></Field>
                          <Field><FieldLabel>Start time</FieldLabel><Input name="startTime" type="datetime-local" /></Field>
                          <Field><FieldLabel>End time</FieldLabel><Input name="endTime" type="datetime-local" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field><FieldLabel>Minutes</FieldLabel><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /></Field>
                          <Field><FieldLabel>Pass mark</FieldLabel><Input name="passMark" type="number" min="0" defaultValue="1" required /></Field>
                          <Field><FieldLabel>Attempts per candidate</FieldLabel><Input name="maxAttempts" type="number" min="1" defaultValue="1" required /></Field>
                        </div>
                      </FieldGroup>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Question source</CardTitle>
                      <CardDescription>Choose a question bank, then select the exact questions to include in this draft.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Question bank</FieldLabel>
                          <select name="questionBank" value={currentBankId} onChange={(event) => { setBankId(event.target.value); setSelectedQuestions([]) }} required className="h-9 rounded-md border bg-background px-3 text-sm">
                            <option value="">Select question bank</option>
                            {banks.data?.map((bank) => <option value={entityId(bank)} key={entityId(bank)}>{bank.title}</option>)}
                          </select>
                        </Field>
                        <div className="grid gap-3 md:grid-cols-2">
                          {(questions.data ?? []).map((question) => {
                            const id = entityId(question)
                            const selected = selectedQuestions.includes(id)
                            return (
                              <label key={id} className={`flex items-start gap-3 rounded-2xl border p-4 text-sm transition ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/20"}`}>
                                <Checkbox checked={selected} onCheckedChange={(checked) => setSelectedQuestions((items) => checked ? [...items, id] : items.filter((item) => item !== id))} />
                                <span>
                                  <span className="block font-medium">{question.questionText}</span>
                                  <span className="mt-1 block text-muted-foreground">{question.topic || "No topic"} • {question.difficulty}</span>
                                </span>
                              </label>
                            )
                          })}
                          {!questions.data?.length && <EmptyState message="Select a question bank first to load your authored questions." />}
                        </div>
                      </FieldGroup>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Candidate information requirements</CardTitle>
                      <CardDescription>Define the base identity fields and any extra lecturer-requested details candidates must complete before starting.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm"><Checkbox checked disabled /> Full name required</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox checked disabled /> Email required</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox name="requirePhone" /> Require phone</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox name="requireIdentifier" /> Require ID / applicant number</label>
                      </div>
                      <div className="space-y-3 rounded-2xl border p-4">
                        <div>
                          <p className="font-medium">Additional candidate fields</p>
                          <p className="text-sm text-muted-foreground">These appear on the public exam start form so candidates can provide the exact information you request.</p>
                        </div>
                        {customFields.map((field, index) => (
                          <div key={`${field.key}-${index}`} className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_1fr_140px_1fr_auto]">
                            <Input value={field.label} placeholder="Field label" onChange={(event) => setCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                            <Input value={field.key} placeholder="fieldKey" onChange={(event) => setCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") } : item))} />
                            <select value={field.type} onChange={(event) => setCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as "text" | "email" | "tel" | "number" } : item))} className="h-9 rounded-md border bg-background px-3 text-sm">
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="tel">Phone</option>
                              <option value="number">Number</option>
                            </select>
                            <Input value={field.placeholder} placeholder="Placeholder" onChange={(event) => setCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, placeholder: event.target.value } : item))} />
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm"><Checkbox checked={field.required} onCheckedChange={(checked) => setCustomFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, required: Boolean(checked) } : item))} /> Required</label>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCustomFields((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove field"><IconTrash /></Button>
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={() => setCustomFields((current) => [...current, { key: "", label: "", type: "text", placeholder: "", required: false }])}>Add requested field</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Anti-cheat settings</CardTitle>
                      <CardDescription>Configure the monitoring experience and the thresholds that can warn or auto-submit a candidate.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
                        {([
                          ["requireFullscreen", "Require fullscreen"], ["detectTabSwitch", "Detect tab changes"], ["detectWindowBlur", "Detect focus loss"],
                          ["disableRightClick", "Block right click"], ["disableCopyPaste", "Block copy/paste"], ["blockDevToolsShortcuts", "Flag devtools shortcuts"],
                          ["preventMultipleSessions", "Prevent duplicate sessions"], ["requireWebcam", "Require webcam"], ["captureSnapshots", "Capture snapshots"],
                          ["captureScreenshots", "Capture screenshots"],
                        ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><Switch checked={antiCheat[key]} onCheckedChange={(checked) => setAntiCheat((current) => ({ ...current, [key]: checked }))} />{label}</label>)}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field><FieldLabel>Warning score</FieldLabel><Input name="warningViolationScore" type="number" min="1" defaultValue="3" /></Field>
                        <Field><FieldLabel>Final warning score</FieldLabel><Input name="finalWarningViolationScore" type="number" min="1" defaultValue="5" /></Field>
                        <Field><FieldLabel>Auto-submit score</FieldLabel><Input name="autoSubmitViolationScore" type="number" min="1" defaultValue="8" /></Field>
                        <Field><FieldLabel>Max tab switches</FieldLabel><Input name="maxTabSwitches" type="number" min="0" defaultValue="2" /></Field>
                        <Field><FieldLabel>Max fullscreen exits</FieldLabel><Input name="maxFullscreenExits" type="number" min="0" defaultValue="2" /></Field>
                        <Field><FieldLabel>Max focus losses</FieldLabel><Input name="maxWindowBlurEvents" type="number" min="0" defaultValue="2" /></Field>
                        <Field><FieldLabel>Max refresh attempts</FieldLabel><Input name="maxRefreshAttempts" type="number" min="0" defaultValue="2" /></Field>
                        <Field><FieldLabel>Maximum away seconds</FieldLabel><Input name="maxAwaySeconds" type="number" min="1" defaultValue="10" /></Field>
                        <Field><FieldLabel>Snapshot interval</FieldLabel><Input name="snapshotIntervalSeconds" type="number" min="1" defaultValue="60" /></Field>
                        <Field><FieldLabel>Screenshot interval</FieldLabel><Input name="screenshotIntervalSeconds" type="number" min="1" defaultValue="60" /></Field>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Publish behavior</CardTitle>
                      <CardDescription>Set how the exam behaves after candidates enter: randomization, result visibility, and secure delivery posture.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm"><Switch checked={options.randomizeQuestions} onCheckedChange={(checked) => setOptions((current) => ({ ...current, randomizeQuestions: checked }))} /> Randomize questions</label>
                        <label className="flex items-center gap-2 text-sm"><Switch checked={options.randomizeOptions} onCheckedChange={(checked) => setOptions((current) => ({ ...current, randomizeOptions: checked }))} /> Randomize options</label>
                        <label className="flex items-center gap-2 text-sm"><Switch checked={options.showResultImmediately} onCheckedChange={(checked) => setOptions((current) => ({ ...current, showResultImmediately: checked }))} /> Show result instantly</label>
                      </div>
                      <div className="rounded-2xl border bg-muted/25 p-4 text-sm text-muted-foreground">
                        Publishing this draft will generate a public exam link, a branded exam code like <span className="font-medium text-foreground">AR1214</span>, and a separate secure 6-digit candidate access code.
                      </div>
                      <Button disabled={action.isPending}>
                        <IconPlus className="size-4" />
                        {action.isPending ? "Saving draft..." : "Save exam draft"}
                      </Button>
                    </CardContent>
                  </Card>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/92 shadow-sm">
            <CardHeader>
              <CardTitle>Managed exams</CardTitle>
              <CardDescription>{canAuthor ? "Your authored exams appear here with access state, publishing controls, and quick actions." : "Review platform exams and open the relevant report or detail workspace."}</CardDescription>
            </CardHeader>
            <CardContent>
              {!sortedExams.length ? (
                <EmptyState message="No exams created yet." />
              ) : (
                <div className="space-y-3">
                  {sortedExams.map((exam) => {
                    const id = entityId(exam)
                    const active = currentActiveExamId === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveExamId(id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/20"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{exam.title}</p>
                              {exam.code && <Badge variant="outline">{exam.code}</Badge>}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {typeof exam.questionBank === "object" && exam.questionBank ? exam.questionBank.title : "Question bank attached"} • {exam.publicUrl ? "Public link ready" : "Link generated on publish"}
                            </p>
                          </div>
                          <StatusBadge status={exam.status} />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Updated {new Date(exam.updatedAt ?? exam.createdAt ?? "").toLocaleString()}</span>
                          <span>•</span>
                          <span>{exam.randomizeQuestions ? "Randomized delivery" : "Fixed order"}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {canAuthor && exam.status === "DRAFT" && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); action.mutate({ path: `/exams/${id}/publish`, method: "POST" }) }}><IconRocket className="size-4" /> Publish</Button>}
                          {canAuthor && ["PUBLISHED", "SCHEDULED", "ACTIVE"].includes(exam.status) && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); action.mutate({ path: `/exams/${id}/close`, method: "POST" }) }}><IconX className="size-4" /> Close</Button>}
                          {canAuthor && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); action.mutate({ path: `/exams/${id}/regenerate-link`, method: "POST" }) }}><IconLink className="size-4" /> Regenerate link</Button>}
                          {canAuthor && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); action.mutate({ path: `/exams/${id}/regenerate-access-code`, method: "POST" }) }}><IconLockShare className="size-4" /> Regenerate 6-digit code</Button>}
                          {canAuthor && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setArchiving(exam) }}><IconTrash className="size-4" /> Archive</Button>}
                          {canOpenExam && <Button size="sm" asChild onClick={(event) => event.stopPropagation()}><Link href={canAuthor ? `${basePath}/${id}` : "/admin/reports"}><IconArrowRight className="size-4" /> {canAuthor ? "Open control room" : "Open reports"}</Link></Button>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedExam && (
            <Card className="border-border/70 bg-card/92 shadow-sm">
              <CardHeader>
                <CardTitle>Access and publishing panel</CardTitle>
                <CardDescription>Focused access details for the selected exam, including the branded code and public entry state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-muted/25 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold">{selectedExam.title}</p>
                    <StatusBadge status={selectedExam.status} />
                    {accessInfo.data?.code && <Badge variant="outline">{accessInfo.data.code}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{accessInfo.data?.publicUrl || selectedExam.publicUrl || "Public link will appear here once the exam is published."}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard label="Branded exam code" value={accessInfo.data?.code || selectedExam.code || "Generated automatically"} />
                  <InfoCard label="Public URL" value={accessInfo.data?.publicUrl || selectedExam.publicUrl || "Available after publish"} />
                  <InfoCard label="Published at" value={accessInfo.data?.publishedAt ? new Date(accessInfo.data.publishedAt).toLocaleString() : "Not published yet"} />
                  <InfoCard label="Last 6-digit code rotation" value={accessInfo.data?.accessCodeLastGeneratedAt ? new Date(accessInfo.data.accessCodeLastGeneratedAt).toLocaleString() : "No 6-digit code generated yet"} />
                </div>
                {canAuthor ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => selectedExam && navigator.clipboard.writeText(accessInfo.data?.publicUrl || selectedExam.publicUrl || "").then(() => toast.success("Public link copied."), () => toast.error("Copy failed."))} disabled={!(accessInfo.data?.publicUrl || selectedExam.publicUrl)}>
                      <IconCopy className="size-4" />
                      Copy public link
                    </Button>
                    <Button variant="outline" onClick={() => selectedExam && action.mutate({ path: `/exams/${entityId(selectedExam)}/regenerate-link`, method: "POST" })}><IconLink className="size-4" /> Regenerate link</Button>
                    <Button variant="outline" onClick={() => selectedExam && action.mutate({ path: `/exams/${entityId(selectedExam)}/regenerate-access-code`, method: "POST" })}><IconLockShare className="size-4" /> Regenerate 6-digit access code</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive examination</AlertDialogTitle>
            <AlertDialogDescription>This examination will leave the active workspace but remain available in platform history and reports.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={action.isPending} onClick={(event) => { event.preventDefault(); if (archiving) action.mutate({ path: `/exams/${entityId(archiving)}`, method: "DELETE" }) }}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 break-all text-sm font-medium">{value}</p>
    </div>
  )
}
