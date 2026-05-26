"use client"

import { useEffect, useState } from "react"
import { IconDownload, IconExternalLink, IconShieldExclamation } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { toast } from "sonner"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiRequestError, apiRequest, currentUser, downloadApiFile, getSession, serverUrl } from "@/lib/api/client"
import type { AntiCheatLog, Attempt, Exam, User } from "@/lib/api/types"

type ResultRow = {
  candidate: string
  email: string
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  status: string
  submittedAt: string
}

export function PlatformReports() {
  const queryClient = useQueryClient()
  const [examId, setExamId] = useState("")
  const { data: actor } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const permitted = actor?.role === "SUPER_ADMIN" || actor?.permissions.includes("VIEW_REPORTS")
  const exams = useQuery({
    queryKey: ["admin", "report-exams"],
    queryFn: () => apiRequest<Exam[]>("/exams?limit=100").then((response) => response.data),
    enabled: Boolean(permitted),
  })
  const results = useQuery({
    queryKey: ["admin", "report-results", examId],
    queryFn: () => apiRequest<ResultRow[]>(`/reports/exams/${examId}/results?limit=100`).then((response) => response.data),
    enabled: Boolean(permitted && examId),
  })
  const logs = useQuery({
    queryKey: ["admin", "integrity-events", examId],
    queryFn: () => apiRequest<AntiCheatLog[]>(`/exams/${examId}/anti-cheat/reports?limit=100&sort=-createdAt`).then((response) => response.data),
    enabled: Boolean(permitted && examId),
  })
  const attempts = useQuery({
    queryKey: ["admin", "attempts", examId],
    queryFn: () => apiRequest<Attempt[]>(`/attempts?exam=${examId}&limit=100&sort=-createdAt`).then((response) => response.data),
    enabled: Boolean(permitted && examId),
  })
  const evidence = useMutation({
    mutationFn: (logId: string) => apiRequest<{ url: string }>(`/anti-cheat/logs/${logId}/evidence-url`).then((response) => response.data),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  useEffect(() => {
    if (!permitted) return
    const token = getSession()?.accessToken
    if (!token) return
    const socket = io(serverUrl, { auth: { token } })
    socket.emit("platform:join-monitoring")
    const refresh = (payload?: { examId?: string }) => {
      if (!examId || !payload?.examId || payload.examId === examId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "integrity-events", examId] })
        queryClient.invalidateQueries({ queryKey: ["admin", "report-results", examId] })
        queryClient.invalidateQueries({ queryKey: ["admin", "attempts", examId] })
      }
    }
    socket.on("exam:anti-cheat-warning", refresh)
    socket.on("exam:anti-cheat-critical", refresh)
    socket.on("exam:candidate-submitted", refresh)
    socket.on("exam:candidate-auto-submitted", refresh)
    return () => {
      socket.disconnect()
    }
  }, [examId, permitted, queryClient])

  async function download(path: string, filename: string) {
    try {
      await downloadApiFile(path, filename)
      toast.success("Report downloaded.")
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Unable to download report.")
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading title="Reports and Integrity" description="Review platform-wide exam outcomes, monitoring signals, and retained evidence." />
      <div className="space-y-4 px-4 lg:px-6">
        {!permitted && actor && (
          <Alert>
            <IconShieldExclamation />
            <AlertTitle>Reporting access required</AlertTitle>
            <AlertDescription>This workspace requires the VIEW REPORTS permission.</AlertDescription>
          </Alert>
        )}
        {permitted && (
          <Card>
            <CardHeader>
              <CardTitle>Examination oversight</CardTitle>
              <CardDescription>Select any examination to inspect candidate results and integrity activity.</CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg">
              <Field>
                <FieldLabel>Examination</FieldLabel>
                <select value={examId} onChange={(event) => setExamId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Select an examination</option>
                  {exams.data?.map((exam) => <option key={entityId(exam)} value={entityId(exam)}>{exam.title} ({exam.status})</option>)}
                </select>
              </Field>
            </CardContent>
          </Card>
        )}
        {permitted && examId && (
          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="sessions">Attempt Sessions</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="integrity">Integrity Events</TabsTrigger>
            </TabsList>
            <TabsContent value="sessions" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Attempt sessions</CardTitle><CardDescription>Server-timed candidate attempts and violation totals.</CardDescription></CardHeader>
                <CardContent>
                  {!attempts.data?.length ? <EmptyState message={attempts.isPending ? "Loading attempts..." : "No candidate attempts are recorded for this examination."} /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead><TableHead>Violation Score</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
                      <TableBody>{attempts.data.map((attempt) => (
                        <TableRow key={entityId(attempt)}>
                          <TableCell>{attempt.candidate?.fullName ?? "-"}</TableCell>
                          <TableCell><StatusBadge status={attempt.status} /></TableCell>
                          <TableCell>{new Date(attempt.expiresAt).toLocaleString()}</TableCell>
                          <TableCell>{attempt.violationScore ?? 0}</TableCell>
                          <TableCell>{attempt.status === "IN_PROGRESS" ? "In progress" : `${attempt.score ?? 0} / ${attempt.totalMarks ?? 0}`}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="results" className="mt-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div><CardTitle>Candidate results</CardTitle><CardDescription>Scores are calculated by the authoritative backend submission flow.</CardDescription></div>
                  <Button variant="outline" onClick={() => download(`/reports/exams/${examId}/results?format=csv`, "argus-exam-results.csv")}><IconDownload /> Export CSV</Button>
                </CardHeader>
                <CardContent>
                  {!results.data?.length ? <EmptyState message={results.isPending ? "Loading results..." : "No submitted results are recorded for this examination."} /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Outcome</TableHead><TableHead>Submission</TableHead></TableRow></TableHeader>
                      <TableBody>{results.data.map((result) => (
                        <TableRow key={`${result.email}-${result.submittedAt}`}>
                          <TableCell><div className="font-medium">{result.candidate}</div><div className="text-xs text-muted-foreground">{result.email}</div></TableCell>
                          <TableCell>{result.score} / {result.totalMarks}</TableCell>
                          <TableCell>{result.percentage}%</TableCell>
                          <TableCell><StatusBadge status={result.passed ? "PASSED" : "FAILED"} /></TableCell>
                          <TableCell><StatusBadge status={result.status} /></TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="integrity" className="mt-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div><CardTitle>Anti-cheat event ledger</CardTitle><CardDescription>Immutable monitoring events and retained private evidence.</CardDescription></div>
                  <Button variant="outline" onClick={() => download(`/reports/exams/${examId}/anti-cheat/export`, "argus-integrity-events.csv")}><IconDownload /> Export CSV</Button>
                </CardHeader>
                <CardContent>
                  {!logs.data?.length ? <EmptyState message={logs.isPending ? "Loading events..." : "No integrity events have been recorded for this examination."} /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Event</TableHead><TableHead>Severity</TableHead><TableHead>Points</TableHead><TableHead>Action</TableHead><TableHead>Evidence</TableHead></TableRow></TableHeader>
                      <TableBody>{logs.data.map((log) => (
                        <TableRow key={entityId(log)}>
                          <TableCell>{(log.candidate as User | undefined)?.fullName ?? "-"}</TableCell>
                          <TableCell><div className="font-medium">{log.eventType.replaceAll("_", " ")}</div><div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div></TableCell>
                          <TableCell><StatusBadge status={log.severity} /></TableCell>
                          <TableCell>{log.points}</TableCell>
                          <TableCell>{log.systemAction.replaceAll("_", " ")}</TableCell>
                          <TableCell>{log.evidence?.publicId ? <Button size="sm" variant="outline" disabled={evidence.isPending} onClick={() => evidence.mutate(entityId(log))}><IconExternalLink /> View</Button> : "-"}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
