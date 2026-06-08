"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { IconCalendarTime, IconChartBar, IconShieldCheck, IconUserPlus } from "@tabler/icons-react"
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"

import { SectionCards, type DashboardCard } from "@/components/section-cards"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest } from "@/lib/api/client"
import type { AdminDashboard, CandidateDashboard, ExaminerDashboard } from "@/lib/api/types"

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "Schedule not set")

export function DashboardHome({ space }: { space: "admin" | "examiner" | "candidate" }) {
  const adminDashboard = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => apiRequest<AdminDashboard>("/dashboard/admin").then((response) => response.data),
    enabled: space === "admin",
  })
  const examinerDashboard = useQuery({
    queryKey: ["dashboard", "examiner"],
    queryFn: () => apiRequest<ExaminerDashboard>("/dashboard/examiner").then((response) => response.data),
    enabled: space === "examiner",
  })
  const candidateDashboard = useQuery({
    queryKey: ["dashboard", "candidate"],
    queryFn: () => apiRequest<CandidateDashboard>("/dashboard/candidate").then((response) => response.data),
    enabled: space === "candidate",
  })

  const cards: DashboardCard[] =
    space === "candidate"
      ? [
          { label: "Available To Take", value: candidateDashboard.data?.summary.availableCount ?? "-", change: "Ready", headline: "Assigned exams ready now", detail: "Exams you can begin from your dashboard" },
          { label: "In Progress", value: candidateDashboard.data?.summary.inProgressCount ?? "-", change: "Live", headline: "Timed session protection", detail: "Server-controlled exam sessions" },
          { label: "Completed", value: candidateDashboard.data?.summary.completedCount ?? "-", change: "Tracked", headline: "Past attempts available", detail: "Submitted exam history and results" },
          { label: "Assigned", value: candidateDashboard.data?.summary.assignedCount ?? "-", change: "Scheduled", headline: "Upcoming exam queue", detail: "Published exams assigned to your account" },
        ]
      : space === "admin"
        ? [
            { label: "Active Users", value: adminDashboard.data?.summary.activeUsers ?? "-", change: "Live", headline: "Accounts in good standing", detail: "Current platform user coverage" },
            { label: "Exams", value: adminDashboard.data?.summary.totalExams ?? "-", change: "Moderated", headline: "Platform-wide exam oversight", detail: "Draft, published, and closed exams" },
            { label: "Attempts", value: adminDashboard.data?.summary.totalAttempts ?? "-", change: "Tracked", headline: "Candidate sessions monitored", detail: "All secure attempt sessions" },
            { label: "Anti-Cheat Events", value: adminDashboard.data?.summary.antiCheatEvents ?? "-", change: "Review", headline: "Integrity signal visibility", detail: "Recorded monitoring activity", trend: "down" },
          ]
        : [
            { label: "Question Banks", value: examinerDashboard.data?.summary.questionBanks ?? "-", change: "Owned", headline: "Your content libraries", detail: "Reusable question bank assets" },
            { label: "Exams", value: examinerDashboard.data?.summary.totalExams ?? "-", change: "Built", headline: "Exams under your workspace", detail: "Draft and published assessments" },
            { label: "Published", value: examinerDashboard.data?.summary.publishedExams ?? "-", change: "Live", headline: "Public or scheduled delivery", detail: "Exams ready for candidate access" },
            { label: "Flagged Attempts", value: examinerDashboard.data?.summary.flaggedAttempts ?? "-", change: "Watch", headline: "Integrity attention needed", detail: "Candidate sessions with violations", trend: "down" },
          ]

  const adminItems = adminDashboard.data?.recentFlaggedAttempts ?? []
  const examinerItems = examinerDashboard.data?.recentExams ?? []
  const candidateItems = candidateDashboard.data?.assignedExams ?? []
  const adminExamStatusChart = adminDashboard.data?.charts?.examStatus ?? []
  const adminInviteChart = adminDashboard.data?.charts?.inviteFunnel ?? []
  const examinerInviteChart = examinerDashboard.data?.charts?.invites ?? []
  const examinerOutcomeChart = examinerDashboard.data?.charts?.outcomes ?? []

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards cards={cards} />
          <div className="grid gap-4 px-4 lg:grid-cols-[1.35fr_.85fr] lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {space === "candidate"
                    ? "Assigned examination queue"
                    : space === "admin"
                      ? "Recent flagged activity"
                      : "Recent published work"}
                </CardTitle>
                <CardDescription>
                  {space === "candidate"
                    ? "Exams assigned to your account appear here automatically when your examiner adds you."
                    : space === "admin"
                      ? "Platform-level sessions and exams that may need moderation attention."
                      : "The latest exams in your workspace and their current access state."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {space === "candidate" && candidateItems.length
                  ? candidateItems.map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between rounded-xl border bg-muted/25 p-4">
                        <div className="space-y-1">
                          <p className="font-medium">{exam.title}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(exam.startTime)}</p>
                          <p className="text-xs text-muted-foreground">{exam.code ?? "Code pending"} - {exam.durationMinutes} minutes</p>
                        </div>
                        <Badge variant="outline">{exam.status}</Badge>
                      </div>
                    ))
                  : space === "admin" && adminItems.length
                    ? adminItems.map((attempt) => (
                        <div key={attempt.id} className="rounded-xl border bg-muted/25 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{attempt.examTitle ?? "Unknown exam"}</p>
                              <p className="text-sm text-muted-foreground">{attempt.candidateName}{attempt.candidateEmail ? ` - ${attempt.candidateEmail}` : ""}</p>
                            </div>
                            <Badge variant="outline">{attempt.status}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">Violation score: {attempt.violationScore} - Updated {formatDate(attempt.updatedAt)}</p>
                        </div>
                      ))
                    : space === "examiner" && examinerItems.length
                      ? examinerItems.map((exam) => (
                          <div key={exam.id} className="flex items-center justify-between rounded-xl border bg-muted/25 p-4">
                            <div className="space-y-1">
                              <p className="font-medium">{exam.title}</p>
                              <p className="text-sm text-muted-foreground">{exam.code ?? "Code pending"} - {formatDate(exam.createdAt)}</p>
                            </div>
                            <Badge variant="outline">{exam.status}</Badge>
                          </div>
                        ))
                      : (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                          <IconChartBar className="size-5" />
                          {space === "candidate"
                            ? "No exams are assigned to your account yet."
                            : space === "admin"
                              ? "No urgent moderation-ready alerts require action."
                              : "No recent exams are available in your workspace yet."}
                        </div>
                      )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
                <CardDescription>Continue your role-specific work.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {space === "admin" && (
                  <Button asChild className="justify-start">
                    <Link href="/admin/users/new"><IconUserPlus /> Provision an account</Link>
                  </Button>
                )}
                {space === "candidate" && candidateDashboard.data?.nextExam && (
                  <Button asChild className="justify-start">
                    <Link href={`/candidate/exams/${candidateDashboard.data.nextExam.id}`}><IconCalendarTime /> Start next available exam</Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="justify-start">
                  <Link href={space === "admin" ? "/admin/exams" : space === "examiner" ? "/examiner/exams" : "/candidate/exams"}><IconCalendarTime /> Review scheduled exams</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href={space === "admin" ? "/admin/reports" : space === "examiner" ? "/examiner/exams" : candidateDashboard.data?.activeAttempt ? `/candidate/attempts/${candidateDashboard.data.activeAttempt.id}` : "/candidate/exams"}>
                    <IconShieldCheck /> {space === "candidate" ? "Open secure attempt room" : "View integrity monitoring"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
          {space !== "candidate" && (
            <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
              <Card>
                <CardHeader>
                  <CardTitle>{space === "admin" ? "Exam status mix" : "Invite verification status"}</CardTitle>
                  <CardDescription>{space === "admin" ? "Live platform distribution of exam lifecycle states." : "How your verified invite lists are progressing."}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={space === "admin" ? adminExamStatusChart : examinerInviteChart}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey={space === "admin" ? "status" : "status"} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{space === "admin" ? "Invite verification funnel" : "Submission outcomes"}</CardTitle>
                  <CardDescription>{space === "admin" ? "Approved students versus verified exam entrants." : "Passed and failed outcomes across submitted attempts."}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={space === "admin" ? adminInviteChart : examinerOutcomeChart} dataKey="total" nameKey={space === "admin" ? "label" : "outcome"} innerRadius={60} outerRadius={96} fill="hsl(var(--primary))" />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
