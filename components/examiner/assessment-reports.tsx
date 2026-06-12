"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { IconChartBar, IconClipboardCheck, IconDownload, IconSearch, IconShieldExclamation, IconTrendingUp } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiRequest, downloadApiFile } from "@/lib/api/client"

type ReportExam = { id: string; title: string; code?: string; status: string; attempts: number; completed: number; autoSubmitted: number; averageScore: number; passRate: number; integrityEvents: number; criticalEvents: number }
type Overview = { summary: { totalExams: number; totalAttempts: number; completedAttempts: number; inProgressAttempts: number; autoSubmittedAttempts: number; overallPassRate: number; integrityEvents: number }; exams: ReportExam[]; recentSubmissions: Array<{ id: string; examId: string; candidate: string; email?: string; status: string; percentage: number; passed: boolean; violationScore: number; submittedAt: string }> }
type ResultRow = { candidate: string; email: string; score: number; totalMarks: number; percentage: number; passed: boolean; status: string; submittedAt: string }

export function AssessmentReports() {
  const [search, setSearch] = useState("")
  const [examId, setExamId] = useState("")
  const overview = useQuery({ queryKey: ["reports", "examiner", "overview"], queryFn: () => apiRequest<Overview>("/reports/examiner/overview").then((r) => r.data) })
  const results = useQuery({ queryKey: ["reports", "examiner", examId], queryFn: () => apiRequest<ResultRow[]>(`/reports/exams/${examId}/results?limit=200`).then((r) => r.data), enabled: Boolean(examId) })
  const exams = useMemo(() => (overview.data?.exams ?? []).filter((exam) => `${exam.title} ${exam.code ?? ""}`.toLowerCase().includes(search.toLowerCase())), [overview.data, search])
  const summary = overview.data?.summary
  const selected = overview.data?.exams.find((exam) => exam.id === examId)
  const download = async (path: string, name: string) => { try { await downloadApiFile(path, name); toast.success("Report downloaded.") } catch { toast.error("Unable to download report.") } }

  return <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Assessment intelligence</p><h1 className="mt-1 text-2xl font-semibold">Assessment Reports</h1><p className="text-sm text-muted-foreground">Measure outcomes, review submissions, and investigate integrity signals across your exams.</p></div>{examId && <Button variant="outline" onClick={() => download(`/reports/exams/${examId}/results?format=csv`, `${selected?.code ?? "exam"}-results.csv`)}><IconDownload /> Export selected results</Button>}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Completed attempts" value={summary?.completedAttempts ?? 0} note={`${summary?.inProgressAttempts ?? 0} currently in progress`} icon={<IconClipboardCheck />} /><Metric title="Overall pass rate" value={`${summary?.overallPassRate ?? 0}%`} note="Across all completed attempts" icon={<IconTrendingUp />} /><Metric title="Auto-submitted" value={summary?.autoSubmittedAttempts ?? 0} note="Requires examiner review" icon={<IconShieldExclamation />} /><Metric title="Integrity events" value={summary?.integrityEvents ?? 0} note={`Across ${summary?.totalExams ?? 0} assessments`} icon={<IconChartBar />} /></div>
    <Card><CardHeader><CardTitle>Exam performance</CardTitle><CardDescription>Select an assessment to open its candidate-level report.</CardDescription></CardHeader><CardContent><div className="relative mb-4 max-w-md"><IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assessments by title or code" className="pl-9" /></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exams.map((exam) => <button key={exam.id} onClick={() => setExamId(exam.id)} className={`rounded-xl border p-4 text-left transition ${examId === exam.id ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{exam.title}</p><p className="font-mono text-xs text-muted-foreground">{exam.code}</p></div><Badge variant="outline">{exam.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Stat label="Completed" value={exam.completed} /><Stat label="Average" value={`${exam.averageScore}%`} /><Stat label="Pass rate" value={`${exam.passRate}%`} /></div><div className="mt-3 flex justify-between border-t pt-3 text-xs text-muted-foreground"><span>{exam.integrityEvents} integrity events</span><span>{exam.autoSubmitted} auto-submitted</span></div></button>)}</div></CardContent></Card>
    {selected && <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{selected.title}</CardTitle><CardDescription>Candidate outcomes and submission status.</CardDescription></div><div className="flex gap-2"><Button asChild variant="outline"><Link href={`/examiner/exams/${selected.id}`}>Open exam</Link></Button><Button variant="outline" onClick={() => download(`/reports/exams/${selected.id}/anti-cheat/export`, `${selected.code ?? "exam"}-integrity.csv`)}><IconDownload /> Integrity CSV</Button></div></CardHeader><CardContent>{!results.data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No completed submissions yet.</p> : <Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Outcome</TableHead><TableHead>Submission</TableHead></TableRow></TableHeader><TableBody>{results.data.map((row) => <TableRow key={`${row.email}-${row.submittedAt}`}><TableCell><p className="font-medium">{row.candidate}</p><p className="text-xs text-muted-foreground">{row.email}</p></TableCell><TableCell>{row.score} / {row.totalMarks}</TableCell><TableCell>{row.percentage}%</TableCell><TableCell><Badge variant={row.passed ? "default" : "destructive"}>{row.passed ? "Passed" : "Failed"}</Badge></TableCell><TableCell><Badge variant="outline">{row.status.replaceAll("_", " ")}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>}
  </div>
}
function Metric({ title, value, note, icon }: { title: string; value: string | number; note: string; icon: React.ReactNode }) { return <Card><CardHeader className="pb-2"><div className="flex items-center justify-between text-muted-foreground"><CardDescription>{title}</CardDescription><span className="size-5">{icon}</span></div><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{note}</CardContent></Card> }
function Stat({ label, value }: { label: string; value: string | number }) { return <div><p className="font-semibold text-foreground">{value}</p><p className="text-muted-foreground">{label}</p></div> }
