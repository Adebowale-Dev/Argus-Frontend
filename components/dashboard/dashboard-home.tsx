"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { IconArrowUpRight, IconBook, IconCalendarTime, IconChartBar, IconPlus, IconShieldCheck, IconUsers } from "@tabler/icons-react"
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"

import { ArgusLineChart } from "@/components/dashboard/argus-line-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest, currentUser } from "@/lib/api/client"
import type { AdminDashboard, CandidateDashboard, ExaminerDashboard } from "@/lib/api/types"

const formatDate = (value?: string) => value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Schedule not set"

export function DashboardHome({ space }: { space: "admin" | "examiner" | "candidate" }) {
  const user = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const admin = useQuery({ queryKey: ["dashboard", "admin"], queryFn: () => apiRequest<AdminDashboard>("/dashboard/admin").then((r) => r.data), enabled: space === "admin" })
  const examiner = useQuery({ queryKey: ["dashboard", "examiner"], queryFn: () => apiRequest<ExaminerDashboard>("/dashboard/examiner").then((r) => r.data), enabled: space === "examiner" })
  const candidate = useQuery({ queryKey: ["dashboard", "candidate"], queryFn: () => apiRequest<CandidateDashboard>("/dashboard/candidate").then((r) => r.data), enabled: space === "candidate" })

  const metrics = space === "admin" ? [
    ["Active users", admin.data?.summary.activeUsers ?? "-", "Platform accounts in good standing", "users"],
    ["Examinations", admin.data?.summary.totalExams ?? "-", "Across the entire platform", "exams"],
    ["Attempt sessions", admin.data?.summary.totalAttempts ?? "-", "Secure sessions monitored", "attempts"],
    ["Integrity events", admin.data?.summary.antiCheatEvents ?? "-", "Signals requiring oversight", "integrity"],
  ] : space === "examiner" ? [
    ["Question banks", examiner.data?.summary.questionBanks ?? "-", "Reusable content libraries", "banks"],
    ["Your examinations", examiner.data?.summary.totalExams ?? "-", "Draft, scheduled, and closed", "exams"],
    ["Published", examiner.data?.summary.publishedExams ?? "-", "Available to candidates", "published"],
    ["Flagged attempts", examiner.data?.summary.flaggedAttempts ?? "-", "Integrity review required", "integrity"],
  ] : [
    ["Available now", candidate.data?.summary.availableCount ?? "-", "Ready for you to begin", "available"],
    ["In progress", candidate.data?.summary.inProgressCount ?? "-", "Secure sessions underway", "progress"],
    ["Completed", candidate.data?.summary.completedCount ?? "-", "Submitted examinations", "complete"],
    ["Assigned", candidate.data?.summary.assignedCount ?? "-", "Your full exam schedule", "assigned"],
  ]
  const list = space === "admin" ? admin.data?.recentFlaggedAttempts ?? [] : space === "examiner" ? examiner.data?.recentExams ?? [] : candidate.data?.assignedExams ?? []
  const barData = space === "admin" ? admin.data?.charts?.examStatus ?? [] : examiner.data?.charts?.invites ?? []
  const pieData = space === "admin" ? admin.data?.charts?.inviteFunnel ?? [] : examiner.data?.charts?.outcomes ?? []
  const primaryHref = space === "admin" ? "/admin/users/new" : space === "examiner" ? "/examiner/exams/create" : candidate.data?.nextExam ? `/candidate/exams/${candidate.data.nextExam.id}` : "/candidate/exams"
  const primaryLabel = space === "admin" ? "Add account" : space === "examiner" ? "Create exam" : "View available exams"

  return <main className="min-h-full bg-muted/20 px-4 py-5 lg:px-6 lg:py-7">
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm md:p-7">
        <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_center,var(--color-primary),transparent_65%)] opacity-[.08] lg:block" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><Badge variant="outline" className="mb-3">{space === "admin" ? "Platform oversight" : space === "examiner" ? "Assessment workspace" : "Candidate workspace"}</Badge><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Welcome back, {user.data?.fullName?.split(" ")[0] ?? "there"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{space === "admin" ? "Monitor platform activity, moderate examinations, and keep ARGUS operating securely." : space === "examiner" ? "Build assessments, understand candidate performance, and respond to integrity signals." : "Review your schedule, continue active sessions, and prepare for your next secure assessment."}</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild><Link href={primaryHref}><IconPlus />{primaryLabel}</Link></Button><Button asChild variant="outline"><Link href={space === "admin" ? "/admin/reports" : space === "examiner" ? "/examiner/reports" : "/candidate/exams"}>Open reports <IconArrowUpRight /></Link></Button></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note, key]) => <Card key={String(key)} className="overflow-hidden shadow-sm"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{note}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 rounded-full bg-primary" /></div></CardContent></Card>)}</section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="shadow-sm"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{space === "candidate" ? "Your examination queue" : space === "admin" ? "Activity requiring attention" : "Recent assessment activity"}</CardTitle><CardDescription>Live, role-specific activity from your ARGUS workspace.</CardDescription></div><Button asChild size="sm" variant="ghost"><Link href={space === "admin" ? "/admin/exams" : space === "examiner" ? "/examiner/exams" : "/candidate/exams"}>View all <IconArrowUpRight /></Link></Button></CardHeader><CardContent className="space-y-2">{list.length ? list.slice(0, 6).map((item) => { const row = item as Record<string, unknown>; return <div key={String(row.id)} className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3.5 transition-colors hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-sm font-medium">{String(row.title ?? row.examTitle ?? row.candidateName ?? "Activity")}</p><p className="mt-1 truncate text-xs text-muted-foreground">{String(row.code ?? row.candidateEmail ?? "Updated activity")} · {formatDate(String(row.createdAt ?? row.startTime ?? row.updatedAt ?? ""))}</p></div><Badge variant="outline">{String(row.status ?? "Active").replaceAll("_", " ")}</Badge></div> }) : <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No recent activity is available yet.</div>}</CardContent></Card>
        <Card className="shadow-sm"><CardHeader><CardTitle>Workspace shortcuts</CardTitle><CardDescription>Move quickly between your most important tasks.</CardDescription></CardHeader><CardContent className="grid gap-2">{space === "admin" ? <><Shortcut href="/admin/users" icon={<IconUsers />} label="Manage accounts" /><Shortcut href="/admin/exams" icon={<IconShieldCheck />} label="Moderate exams" /><Shortcut href="/admin/reports" icon={<IconChartBar />} label="Integrity reports" /></> : space === "examiner" ? <><Shortcut href="/examiner/questions" icon={<IconBook />} label="Question banks" /><Shortcut href="/examiner/exams" icon={<IconShieldCheck />} label="Manage examinations" /><Shortcut href="/examiner/reports" icon={<IconChartBar />} label="Assessment reports" /></> : <><Shortcut href="/candidate/exams" icon={<IconCalendarTime />} label="My examinations" /><Shortcut href="/candidate/dashboard" icon={<IconShieldCheck />} label="Secure session readiness" /></>}</CardContent></Card>
      </section>

      {space !== "candidate" && <section className="grid gap-5 xl:grid-cols-2"><ArgusLineChart title={space === "admin" ? "Exam lifecycle" : "Candidate invite progress"} description="Current distribution across your workspace" data={barData.map((item) => ({ label: item.status, value: item.total }))} valueLabel={space === "admin" ? "Exams" : "Invites"} footer={space === "admin" ? "Platform exam status distribution" : "Verified candidate access progression"} /><ArgusLineChart title={space === "admin" ? "Candidate access funnel" : "Assessment outcomes"} description="A compact view of completion and performance" data={pieData.map((item) => ({ label: ("label" in item ? item.label : item.outcome), value: item.total }))} valueLabel={space === "admin" ? "Candidates" : "Outcomes"} footer={space === "admin" ? "Approved and verified access activity" : "Passed and failed submission outcomes"} /></section>}
    </div>
  </main>
}

function Shortcut({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <Button asChild variant="outline" className="h-11 justify-between"><Link href={href}><span className="flex items-center gap-2">{icon}{label}</span><IconArrowUpRight /></Link></Button> }


