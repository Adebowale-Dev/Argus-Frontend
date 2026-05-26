"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { IconCopy, IconDownload, IconRadio, IconRefresh, IconSearch, IconShieldLock, IconUserPlus, IconUsers } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { toast } from "sonner"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiRequest, ApiRequestError, downloadApiFile, getSession, serverUrl } from "@/lib/api/client"
import type { AntiCheatLog, Attempt, Exam, User } from "@/lib/api/types"

type AccessInfo = Pick<Exam, "title" | "publicUrl" | "publicSlug" | "status" | "accessType"> & {
  accessCodeLastGeneratedAt?: string
  accessCodeRegeneratedCount?: number
}

type ResultRow = { candidate: string; email: string; score: number; totalMarks: number; percentage: number; passed: boolean; status: string; submittedAt: string }

export function ExamControlRoom() {
  const { examId } = useParams<{ examId: string }>()
  const queryClient = useQueryClient()
  const [candidateSearch, setCandidateSearch] = useState("")
  const exam = useQuery({ queryKey: ["exam", examId], queryFn: () => apiRequest<Exam>(`/exams/${examId}`).then((response) => response.data) })
  const accessInfo = useQuery({ queryKey: ["exam", examId, "access"], queryFn: () => apiRequest<AccessInfo>(`/exams/${examId}/access-info`).then((response) => response.data) })
  const attempts = useQuery({ queryKey: ["exam", examId, "attempts"], queryFn: () => apiRequest<Attempt[]>(`/exams/${examId}/attempts?limit=50`).then((response) => response.data) })
  const results = useQuery({ queryKey: ["exam", examId, "results"], queryFn: () => apiRequest<ResultRow[]>(`/reports/exams/${examId}/results?limit=50`).then((response) => response.data) })
  const logs = useQuery({ queryKey: ["exam", examId, "anti-cheat"], queryFn: () => apiRequest<AntiCheatLog[]>(`/exams/${examId}/anti-cheat/reports?limit=50`).then((response) => response.data) })
  const assignedCandidates = useQuery({ queryKey: ["exam", examId, "candidates"], queryFn: () => apiRequest<User[]>(`/exams/${examId}/candidates`).then((response) => response.data) })
  const candidateDirectory = useQuery({
    queryKey: ["candidate-directory", candidateSearch],
    queryFn: () => apiRequest<User[]>(`/users?role=CANDIDATE&limit=12${candidateSearch ? `&search=${encodeURIComponent(candidateSearch)}` : ""}`).then((response) => response.data),
  })
  const assignedIds = useMemo(() => new Set((assignedCandidates.data ?? []).map((candidate) => candidate.id ?? candidate._id ?? "")), [assignedCandidates.data])

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
    return () => {
      socket.disconnect()
    }
  }, [examId, queryClient])

  const action = useMutation({
    mutationFn: ({ path, successMessage }: { path: string; successMessage: string }) => apiRequest(path, { method: "POST" }).then(() => successMessage),
    onSuccess: (message) => {
      toast.success(message)
      queryClient.invalidateQueries({ queryKey: ["exam", examId] })
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "access"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const assignCandidate = useMutation({
    mutationFn: (candidateId: string) => apiRequest<{ examId: string; assignedCount: number }>(`/exams/${examId}/assign-candidates`, {
      method: "POST",
      body: JSON.stringify({ candidateIds: [candidateId] }),
    }).then((response) => response.data),
    onSuccess: (data) => {
      toast.success(`Candidate added. ${data.assignedCount} candidate(s) now assigned.`)
      queryClient.invalidateQueries({ queryKey: ["exam", examId, "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard", "candidate"] })
      queryClient.invalidateQueries({ queryKey: ["candidate", "all-exams"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  async function copyPublicUrl() {
    if (!accessInfo.data?.publicUrl) return
    await navigator.clipboard.writeText(accessInfo.data.publicUrl)
    toast.success("Public exam link copied.")
  }

  async function download(path: string, filename: string) {
    try {
      await downloadApiFile(path, filename)
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading title={exam.data?.title ?? "Exam Control Room"} description="Monitor public exam access, candidate attempts, submissions, and anti-cheat events." action={exam.data && <StatusBadge status={exam.data.status} />} />
      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IconShieldLock className="size-5" /> Public access</CardTitle>
            <CardDescription>The plain 6-digit code is never shown again after generation, but you can regenerate it safely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4">
              <div className="text-sm text-muted-foreground">Public URL</div>
              <div className="mt-1 break-all font-medium">{accessInfo.data?.publicUrl ?? "Generated on publish"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyPublicUrl} disabled={!accessInfo.data?.publicUrl}><IconCopy /> Copy link</Button>
              <Button variant="outline" onClick={() => action.mutate({ path: `/exams/${examId}/regenerate-link`, successMessage: "New public link generated." })}><IconRefresh /> Regenerate link</Button>
              <Button variant="outline" onClick={() => action.mutate({ path: `/exams/${examId}/regenerate-access-code`, successMessage: "New access code generated and returned through the secure response." })}><IconRefresh /> Regenerate code</Button>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <Badge variant="outline">{accessInfo.data?.accessType ?? exam.data?.accessType ?? "PUBLIC_LINK_WITH_CODE"}</Badge>
              <span>Last code generation: {accessInfo.data?.accessCodeLastGeneratedAt ? new Date(accessInfo.data.accessCodeLastGeneratedAt).toLocaleString() : "Not generated yet"}</span>
              <span>Code regenerations: {accessInfo.data?.accessCodeRegeneratedCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Candidate intake</CardTitle><CardDescription>These are the details candidates must provide before they can begin.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Full name: <strong>{exam.data?.candidateIdentityRequirements?.fullName ? "Required" : "Optional"}</strong></div>
            <div>Email: <strong>{exam.data?.candidateIdentityRequirements?.email ? "Required" : "Optional"}</strong></div>
            <div>Phone: <strong>{exam.data?.candidateIdentityRequirements?.phone ? "Required" : "Optional"}</strong></div>
            <div>Identifier: <strong>{exam.data?.candidateIdentityRequirements?.identifier ? "Required" : "Optional"}</strong></div>
            {exam.data?.candidateIdentityRequirements?.customFields?.length ? exam.data.candidateIdentityRequirements.customFields.map((field) => <div key={field.key}>{field.label}: <strong>{field.required ? "Required" : "Optional"}</strong></div>) : <div className="text-muted-foreground">No extra lecturer-requested fields configured.</div>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IconUsers className="size-5" /> Logged-in candidate assignment</CardTitle>
            <CardDescription>Assigned candidates automatically see this exam inside their candidate dashboard and secure exam list.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <div className="space-y-4">
              <div className="relative">
                <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search candidate name, username, or email" className="pl-9" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(candidateDirectory.data ?? []).map((candidate) => {
                  const candidateId = candidate.id ?? candidate._id ?? ""
                  const alreadyAssigned = assignedIds.has(candidateId)
                  return (
                    <div key={candidateId} className="rounded-2xl border bg-muted/20 p-4">
                      <div className="space-y-1">
                        <p className="font-medium">{candidate.fullName}</p>
                        <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        <p className="text-xs text-muted-foreground">{candidate.username ? `@${candidate.username}` : "No username"} · {candidate.status}</p>
                      </div>
                      <Button className="mt-4 w-full" variant={alreadyAssigned ? "outline" : "default"} disabled={alreadyAssigned || assignCandidate.isPending} onClick={() => assignCandidate.mutate(candidateId)}>
                        <IconUserPlus />
                        {alreadyAssigned ? "Already assigned" : "Assign to this exam"}
                      </Button>
                    </div>
                  )
                })}
              </div>
              {!candidateDirectory.data?.length && <EmptyState message="No candidate accounts matched this search." />}
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border bg-muted/25 p-4">
                <p className="text-sm font-medium">Assigned candidate accounts</p>
                <p className="mt-1 text-sm text-muted-foreground">These users can sign in and start this exam from their personal dashboard.</p>
              </div>
              {!assignedCandidates.data?.length ? <EmptyState message="No logged-in candidate accounts are assigned yet." /> : assignedCandidates.data.map((candidate) => (
                <div key={candidate.id ?? candidate._id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{candidate.fullName}</p>
                      <p className="text-sm text-muted-foreground">{candidate.email}</p>
                    </div>
                    <Badge variant="outline">{candidate.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Attempts</CardTitle><CardDescription>All public candidates who have started this exam.</CardDescription></CardHeader>
          <CardContent>
            {!attempts.data?.length ? <EmptyState message="No attempts started yet." /> : (
              <Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Status</TableHead><TableHead>Violation score</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
                <TableBody>{attempts.data.map((attempt) => <TableRow key={entityId(attempt)}>
                  <TableCell><div className="font-medium">{attempt.candidateProfile?.fullName ?? attempt.candidate?.fullName ?? "-"}</div><div className="text-xs text-muted-foreground">{attempt.candidateProfile?.email ?? attempt.candidate?.email ?? "-"}</div></TableCell>
                  <TableCell><StatusBadge status={attempt.status} /></TableCell>
                  <TableCell>{attempt.violationScore ?? 0}</TableCell>
                  <TableCell>{attempt.status === "IN_PROGRESS" ? "In progress" : attempt.expiresAt ? new Date(attempt.expiresAt).toLocaleString() : "-"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Submission results</CardTitle><CardDescription>Backend-graded candidate attempts.</CardDescription></div><Button variant="outline" onClick={() => download(`/reports/exams/${examId}/results?format=csv`, "exam-results.csv")}><IconDownload /> Export CSV</Button></CardHeader>
          <CardContent>
            {!results.data?.length ? <EmptyState message="No submitted attempts yet." /> : (
              <Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                <TableBody>{results.data.map((row) => <TableRow key={`${row.email}-${row.submittedAt}`}>
                  <TableCell><div className="font-medium">{row.candidate}</div><div className="text-xs text-muted-foreground">{row.email}</div></TableCell>
                  <TableCell>{row.score} / {row.totalMarks}</TableCell>
                  <TableCell>{row.percentage}%</TableCell>
                  <TableCell><Badge variant={row.passed ? "default" : "outline"}>{row.passed ? "Passed" : "Failed"}</Badge></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><IconRadio className="size-5" /> Integrity feed</CardTitle><CardDescription>Immutable anti-cheat events.</CardDescription></div><Button variant="outline" onClick={() => download(`/reports/exams/${examId}/anti-cheat/export`, "anti-cheat.csv")}><IconDownload /> Export</Button></CardHeader>
          <CardContent>
            {!logs.data?.length ? <EmptyState message="No integrity events recorded." /> : (
              <div className="space-y-3">{logs.data.slice(0, 10).map((log) => <div key={entityId(log)} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{log.eventType.replaceAll("_", " ")}</span><Badge variant="outline">{log.severity}</Badge></div>
                <div className="mt-1 text-muted-foreground">{log.description || log.systemAction}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
              </div>)}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
