"use client"

import { useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconBook2,
  IconCopy,
  IconEdit,
  IconFileDownload,
  IconFileImport,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ApiRequestError, apiRequest, downloadApiFile } from "@/lib/api/client"
import type { Question, QuestionBank as QuestionBankType } from "@/lib/api/types"

function issueMessages(issue: Record<string, unknown>) {
  const issues = Array.isArray(issue.issues) ? issue.issues as Array<Record<string, unknown>> : []
  return issues
    .map((entry) => {
      const path = Array.isArray(entry.path) ? entry.path.join(".") : "row"
      const message = typeof entry.message === "string" ? entry.message : "Invalid value"
      return `${path}: ${message}`
    })
    .filter(Boolean)
}

function questionBankId(value: Question["questionBank"]) {
  if (!value) return ""
  if (typeof value === "string") return value
  return entityId(value)
}

function questionBody(form: FormData, questionBank: string) {
  const options = ["A", "B", "C", "D"].map((key) => ({ key, text: String(form.get(`option${key}`) ?? "").trim() })).filter((option) => option.text)
  return {
    questionBank,
    questionText: String(form.get("questionText")),
    questionType: String(form.get("questionType")),
    options,
    correctAnswer: String(form.get("correctAnswer")).split(",").map((key) => key.trim().toUpperCase()).filter(Boolean),
    marks: Number(form.get("marks")),
    difficulty: String(form.get("difficulty")),
    topic: String(form.get("topic")),
    tags: String(form.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
    explanation: String(form.get("explanation")),
  }
}

type ImportPreviewRow = {
  row: number
  questionText: string
  questionType: string
  marks: number
  difficulty: string
  topic?: string
  optionCount: number
  correctAnswer: string[]
  tags: string[]
}

export function QuestionBank() {
  const queryClient = useQueryClient()
  const [bankId, setBankId] = useState("")
  const [editing, setEditing] = useState<Question | null>(null)
  const [createQuestionOpen, setCreateQuestionOpen] = useState(false)
  const [createBankOpen, setCreateBankOpen] = useState(false)
  const [importIssues, setImportIssues] = useState<Array<Record<string, unknown>>>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)
  const [search, setSearch] = useState("")
  const banks = useQuery({
    queryKey: ["question-banks"],
    queryFn: () => apiRequest<QuestionBankType[]>("/question-banks?limit=50").then((response) => response.data),
  })
  const allQuestions = useQuery({
    queryKey: ["questions", "all"],
    queryFn: () => apiRequest<Question[]>("/questions?limit=100").then((response) => response.data),
  })
  const currentBankId = bankId || entityId(banks.data?.[0] ?? {})
  const questions = useQuery({
    queryKey: ["questions", currentBankId],
    queryFn: () => apiRequest<Question[]>(`/questions?limit=100${currentBankId ? `&questionBank=${currentBankId}` : ""}`).then((response) => response.data),
    enabled: Boolean(currentBankId),
  })
  const bankMutation = useMutation({
    mutationFn: (body: object) => apiRequest<QuestionBankType>("/question-banks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (response) => {
      toast.success("Question bank created.")
      setBankId(entityId(response.data))
      setCreateBankOpen(false)
      queryClient.invalidateQueries({ queryKey: ["question-banks"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const questionMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: "POST" | "PATCH" | "DELETE"; body?: BodyInit }) => apiRequest(path, { method, body }),
    onSuccess: (_response, variables) => {
      toast.success(variables.method === "DELETE" ? "Question removed from this bank." : editing ? "Question updated." : "Question saved.")
      setEditing(null)
      setDeleteTarget(null)
      if (variables.method === "DELETE") {
        queryClient.setQueryData<Question[] | undefined>(["questions", currentBankId], (current) =>
          (current ?? []).filter((item) => entityId(item) !== variables.path.split("/").pop())
        )
      }
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      queryClient.invalidateQueries({ queryKey: ["question-banks"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const previewImport = useMutation({
    mutationFn: (file: File) => {
      if (!currentBankId) throw new ApiRequestError("Select a question bank before previewing an import.", 400)
      const form = new FormData()
      form.append("file", file)
      return apiRequest<ImportPreviewRow[]>("/questions/bulk-import/preview", { method: "POST", body: form, headers: { "X-Question-Bank": currentBankId } }).then((response) => response.data)
    },
    onSuccess: (rows, file) => {
      setImportIssues([])
      setImportFile(file)
      setImportPreview(rows)
      toast.success(`Preview ready for ${rows.length} question${rows.length === 1 ? "" : "s"}.`)
    },
    onError: (error: ApiRequestError) => {
      setImportFile(null)
      setImportPreview([])
      setImportIssues(error.details)
      toast.error(error.message)
    },
  })
  const importQuestions = useMutation({
    mutationFn: (file: File) => {
      if (!currentBankId) throw new ApiRequestError("Select a question bank before importing.", 400)
      const form = new FormData()
      form.append("file", file)
      return apiRequest("/questions/bulk-import", { method: "POST", body: form, headers: { "X-Question-Bank": currentBankId } })
    },
    onSuccess: () => {
      setImportIssues([])
      setImportFile(null)
      setImportPreview([])
      toast.success("Question CSV imported.")
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      queryClient.invalidateQueries({ queryKey: ["question-banks"] })
    },
    onError: (error: ApiRequestError) => {
      setImportIssues(error.details)
      toast.error(error.message)
    },
  })
  const cloneQuestions = useMutation({
    mutationFn: (sourceQuestionIds: string[]) => {
      if (!currentBankId) throw new ApiRequestError("Select a question bank before copying questions.", 400)
      return apiRequest("/questions/clone", {
        method: "POST",
        body: JSON.stringify({ questionBank: currentBankId, sourceQuestionIds }),
      })
    },
    onSuccess: () => {
      toast.success("Questions copied into this bank.")
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      queryClient.invalidateQueries({ queryKey: ["question-banks"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  const selectedBank = banks.data?.find((bank) => entityId(bank) === currentBankId) ?? null
  const filteredBankQuestions = (questions.data ?? []).filter((question) => question.status !== "INACTIVE")
  const copyCandidates = useMemo(() => {
    return (allQuestions.data ?? []).filter((question) => {
      const matchesSearch = !search || question.questionText.toLowerCase().includes(search.toLowerCase()) || (question.topic ?? "").toLowerCase().includes(search.toLowerCase())
      const fromOtherBank = questionBankId(question.questionBank) !== currentBankId
      return fromOtherBank && matchesSearch
    })
  }, [allQuestions.data, currentBankId, search])
  const [selectedCopyIds, setSelectedCopyIds] = useState<string[]>([])

  function createBank(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    bankMutation.mutate({
      title: String(form.get("title")),
      description: String(form.get("description")),
      tags: String(form.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
    })
  }

  function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentBankId) return toast.error("Create or select a question bank first.")
    const body = JSON.stringify(questionBody(new FormData(event.currentTarget), currentBankId))
    const isEditing = Boolean(editing && entityId(editing))
    questionMutation.mutate({ path: isEditing ? `/questions/${entityId(editing as Question)}` : "/questions", method: isEditing ? "PATCH" : "POST", body })
    if (!isEditing) {
      event.currentTarget.reset()
      setCreateQuestionOpen(false)
    }
  }

  function startImportPreview(file: File) {
    previewImport.mutate(file)
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading
        title="Question Banks"
        description="Organize your private assessment content into professional banks, then add questions manually, by CSV, or by reusing your existing work."
        action={<Button onClick={() => setCreateBankOpen(true)}><IconPlus className="size-4" /> Create question bank</Button>}
      />

      <div className="grid gap-4 px-4 lg:px-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IconBook2 className="size-5" /> Your banks</CardTitle>
            <CardDescription>Pick a bank to manage its questions, imports, and reusable content.</CardDescription>
          </CardHeader>
          <CardContent>
            {!banks.data?.length ? (
              <EmptyState message="No question bank exists yet. Create one to start authoring your exams professionally." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {banks.data.map((bank) => {
                  const selected = entityId(bank) === bankId
                  return (
                    <button
                      key={entityId(bank)}
                      type="button"
                      onClick={() => setBankId(entityId(bank))}
                      className={`rounded-2xl border p-5 text-left transition hover:border-primary/50 hover:bg-primary/5 ${selected ? "border-primary bg-primary/5 shadow-sm" : "bg-background"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{bank.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{bank.description || "No description yet."}</p>
                        </div>
                        <Badge variant="outline">{bank.questionCount ?? 0} questions</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(bank.tags ?? []).length ? bank.tags?.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <Badge variant="secondary">Ready for authoring</Badge>}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Updated {bank.updatedAt ? new Date(bank.updatedAt).toLocaleDateString() : "recently"}</span>
                        <span>{selected ? "Selected" : "Open bank"}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IconSparkles className="size-5" /> Selected bank workspace</CardTitle>
            <CardDescription>The chosen bank becomes your focused authoring space for creation, import, and review.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBank ? (
              <EmptyState message="Select a question bank to unlock question authoring tools." />
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border bg-muted/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Active bank</p>
                      <h3 className="text-2xl font-semibold">{selectedBank.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{selectedBank.description || "Use this bank to build questions for a secure public-link exam."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedBank.questionCount ?? 0} questions</Badge>
                      <Badge variant="secondary">{selectedBank.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selectedBank.tags ?? []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    <Button onClick={() => setCreateQuestionOpen(true)} className="ml-auto"><IconPlus className="size-4" /> Add question</Button>
                  </div>
                </div>

                <Tabs defaultValue="manual" className="gap-4">
                  <TabsList variant="line" className="w-full justify-start">
                    <TabsTrigger value="manual">Manual</TabsTrigger>
                    <TabsTrigger value="csv">Import CSV</TabsTrigger>
                    <TabsTrigger value="existing">Import from existing questions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual">
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle>Create a question manually</CardTitle>
                        <CardDescription>Compose the question, define the options, and store the correct answer only on the protected examiner side.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={saveQuestion}>
                          <QuestionFields pending={questionMutation.isPending} submitLabel="Save question" />
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="csv">
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle>Import with CSV</CardTitle>
                        <CardDescription>Download the ARGUS template, fill it with your questions, then upload the completed file into this bank.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                          <Button variant="outline" onClick={() => downloadApiFile("/questions/import-template", "argus-question-import-template.csv")}>
                            <IconFileDownload className="size-4" />
                            Download template
                          </Button>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                            <IconFileImport className="size-4" /> Upload CSV
                            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) startImportPreview(file); event.target.value = "" }} />
                          </label>
                        </div>
                        <div className="rounded-2xl border bg-muted/25 p-4 text-sm text-muted-foreground">
                          Expected columns: <span className="font-medium text-foreground">questionText</span>, <span className="font-medium text-foreground">questionType</span>, <span className="font-medium text-foreground">options</span>, <span className="font-medium text-foreground">correctAnswer</span>, <span className="font-medium text-foreground">marks</span>, <span className="font-medium text-foreground">difficulty</span>, <span className="font-medium text-foreground">topic</span>, <span className="font-medium text-foreground">tags</span>, and <span className="font-medium text-foreground">explanation</span>.
                        </div>
                        {importPreview.length ? (
                          <div className="rounded-2xl border bg-background p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">Preview before import</p>
                                <p className="text-sm text-muted-foreground">{importFile?.name ?? "Selected CSV"} will add {importPreview.length} validated question{importPreview.length === 1 ? "" : "s"} to this bank.</p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { setImportFile(null); setImportPreview([]) }}>Cancel</Button>
                                <Button disabled={!importFile || importQuestions.isPending} onClick={() => importFile && importQuestions.mutate(importFile)}>
                                  {importQuestions.isPending ? "Importing..." : "Confirm and import"}
                                </Button>
                              </div>
                            </div>
                            <div className="mt-4 space-y-3">
                              {importPreview.slice(0, 5).map((row) => (
                                <div key={`${row.row}-${row.questionText}`} className="rounded-xl border bg-muted/20 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium">Row {row.row}: {row.questionText}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{row.questionType.replaceAll("_", " ")} · {row.optionCount} options · Correct: {row.correctAnswer.join(", ")}</p>
                                    </div>
                                    <Badge variant="outline">{row.difficulty}</Badge>
                                  </div>
                                </div>
                              ))}
                              {importPreview.length > 5 ? <p className="text-xs text-muted-foreground">Showing the first 5 questions in preview. The remaining validated rows will import too.</p> : null}
                            </div>
                          </div>
                        ) : null}
                        {importIssues.length ? (
                          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                            <p className="font-medium text-destructive">Import needs attention</p>
                            <div className="mt-3 space-y-2 text-muted-foreground">
                              {importIssues.slice(0, 5).map((issue, index) => (
                                <div key={index} className="rounded-xl border border-destructive/20 bg-background px-3 py-2">
                                  <p className="font-medium text-foreground">Row {String(issue.row ?? index + 1)} has validation issues.</p>
                                  <div className="mt-2 space-y-1 text-xs">
                                    {issueMessages(issue).map((message) => (
                                      <p key={message}>{message}</p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="existing">
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle>Import from existing questions</CardTitle>
                        <CardDescription>Search your other questions, then copy the chosen ones into this bank without retyping them.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative">
                          <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by question text or topic" className="pl-9" />
                        </div>
                        <div className="max-h-80 space-y-3 overflow-y-auto">
                          {copyCandidates.length ? copyCandidates.map((question) => {
                            const id = entityId(question)
                            const selected = selectedCopyIds.includes(id)
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setSelectedCopyIds((current) => selected ? current.filter((item) => item !== id) : [...current, id])}
                                className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/20"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{question.questionText}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{question.topic || "Untagged topic"}</p>
                                  </div>
                                  <Badge variant="outline">{question.difficulty}</Badge>
                                </div>
                              </button>
                            )
                          }) : <EmptyState message="No reusable questions match your current search." />}
                        </div>
                        <Button disabled={!selectedCopyIds.length || cloneQuestions.isPending} onClick={() => cloneQuestions.mutate(selectedCopyIds)}>
                          <IconCopy className="size-4" />
                          {cloneQuestions.isPending ? "Copying..." : `Copy ${selectedCopyIds.length || ""} question${selectedCopyIds.length === 1 ? "" : "s"}`}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card className="border-border/70 bg-card/92 shadow-sm">
          <CardHeader>
            <CardTitle>Questions in this bank</CardTitle>
            <CardDescription>Review the live contents of your selected bank, then edit or deactivate individual items when needed.</CardDescription>
          </CardHeader>
          <CardContent>
            {!filteredBankQuestions.length ? (
              <EmptyState message={selectedBank ? "This bank has no questions yet." : "Choose a question bank to review its questions."} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBankQuestions.map((question) => (
                    <TableRow key={entityId(question)}>
                      <TableCell>
                        <div className="max-w-xl">
                          <p className="font-medium">{question.questionText}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{question.topic || "No topic"} • {question.questionType.replaceAll("_", " ")}</p>
                        </div>
                      </TableCell>
                      <TableCell>{question.difficulty}</TableCell>
                      <TableCell>{question.marks}</TableCell>
                      <TableCell><StatusBadge status={question.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(question)} aria-label="Edit question"><IconEdit /></Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(question)} aria-label="Deactivate question"><IconTrash /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createBankOpen} onOpenChange={setCreateBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create question bank</DialogTitle>
            <DialogDescription>Give this bank a clear title and a short description so it stays easy to reuse later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createBank}>
            <FieldGroup>
              <Field><FieldLabel>Bank title</FieldLabel><Input name="title" placeholder="Frontend Hiring Assessment" required /></Field>
              <Field><FieldLabel>Description</FieldLabel><Textarea name="description" /></Field>
              <Field><FieldLabel>Tags</FieldLabel><Input name="tags" placeholder="react, hiring, junior" /></Field>
              <DialogFooter><Button disabled={bankMutation.isPending}>{bankMutation.isPending ? "Creating..." : "Create bank"}</Button></DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing) || createQuestionOpen} onOpenChange={(open) => { if (!open) { setEditing(null); setCreateQuestionOpen(false) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.questionText ? "Edit question" : "Add question manually"}</DialogTitle>
            <DialogDescription>{editing?.questionText ? "Update the question in its current bank." : "Create a new question inside the selected question bank."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveQuestion}>
            <QuestionFields question={editing?.questionText ? editing : undefined} pending={questionMutation.isPending} submitLabel={editing?.questionText ? "Save changes" : "Save question"} />
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove question from this bank</AlertDialogTitle>
            <AlertDialogDescription>
              This question will be deactivated and removed from your active bank view. You can still keep it in platform history for audit and reporting purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex items-start gap-3">
              <IconAlertTriangle className="mt-0.5 size-4 text-destructive" />
              <div>
                <p className="font-medium text-foreground">{deleteTarget?.questionText}</p>
                <p className="mt-1 text-muted-foreground">This action updates the question status and removes it from the current working list immediately.</p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={questionMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (deleteTarget) questionMutation.mutate({ path: `/questions/${entityId(deleteTarget)}`, method: "DELETE" })
              }}
            >
              {questionMutation.isPending ? "Removing..." : "Remove question"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function QuestionFields({ question, submitLabel, pending }: { question?: Question; submitLabel: string; pending: boolean }) {
  const option = (key: string) => question?.options.find((item) => item.key === key)?.text ?? ""
  return (
    <FieldGroup>
      <Field><FieldLabel>Question</FieldLabel><Textarea name="questionText" defaultValue={question?.questionText} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel>Type</FieldLabel><select name="questionType" defaultValue={question?.questionType ?? "SINGLE_SELECT"} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="SINGLE_SELECT">Single Select</option><option value="MULTIPLE_CHOICE">Multiple Choice</option><option value="TRUE_FALSE">True / False</option></select></Field>
        <Field><FieldLabel>Difficulty</FieldLabel><select name="difficulty" defaultValue={question?.difficulty ?? "MEDIUM"} className="h-9 rounded-md border bg-background px-3 text-sm"><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="optionA" placeholder="Option A" defaultValue={option("A")} required />
        <Input name="optionB" placeholder="Option B" defaultValue={option("B")} required />
        <Input name="optionC" placeholder="Option C" defaultValue={option("C")} />
        <Input name="optionD" placeholder="Option D" defaultValue={option("D")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel>Correct key(s)</FieldLabel><Input name="correctAnswer" defaultValue={question?.correctAnswer?.join(",") ?? "A"} placeholder="A or A,C" required /></Field>
        <Field><FieldLabel>Marks</FieldLabel><Input name="marks" type="number" min="1" defaultValue={question?.marks ?? 1} required /></Field>
      </div>
      <Field><FieldLabel>Topic</FieldLabel><Input name="topic" defaultValue={question?.topic} /></Field>
      <Field><FieldLabel>Tags</FieldLabel><Input name="tags" defaultValue={question?.tags?.join(", ")} placeholder="security, hiring" /></Field>
      <Field><FieldLabel>Explanation</FieldLabel><Textarea name="explanation" defaultValue={question?.explanation} /></Field>
      <DialogFooter><Button disabled={pending}>{pending ? "Saving..." : submitLabel}</Button></DialogFooter>
    </FieldGroup>
  )
}
