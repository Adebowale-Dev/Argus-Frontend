"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { IconCalendarTime, IconShieldCheck, IconUserPlus } from "@tabler/icons-react"

import { SectionCards, type DashboardCard } from "@/components/section-cards"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest, currentUser } from "@/lib/api/client"

type DashboardStats = { activeUsers: number; exams: number; attempts: number; antiCheatEvents: number }
type Exam = { _id?: string; id?: string; title: string; startTime: string; status: string; durationMinutes: number }

export function DashboardHome({ space }: { space: "admin" | "examiner" | "candidate" }) {
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const reportsAllowed = space !== "candidate" && (user?.role !== "SUB_ADMIN" || user.permissions.includes("VIEW_REPORTS"))
  const stats = useQuery({
    queryKey: ["dashboard", space],
    queryFn: () => apiRequest<DashboardStats>("/reports/dashboard").then((response) => response.data),
    enabled: Boolean(user && reportsAllowed),
  })
  const exams = useQuery({
    queryKey: ["candidate", "exams"],
    queryFn: () => apiRequest<Exam[]>("/candidate/exams?limit=4").then((response) => response.data),
    enabled: space === "candidate" && Boolean(user),
  })

  const cards: DashboardCard[] = space === "candidate"
    ? [
        { label: "Assigned Exams", value: exams.data?.length ?? "-", change: "Available", headline: "Ready for your schedule", detail: "Published assessments assigned to you" },
        { label: "Monitoring", value: "Active", change: "Enabled", headline: "Integrity rules enabled", detail: "Server-authoritative anti-cheat tracking" },
        { label: "Session Security", value: "Secure", change: "Protected", headline: "Timed attempts protected", detail: "Your submissions are server controlled" },
      ]
    : [
        { label: "Active Users", value: stats.data?.activeUsers ?? "-", change: "Live", headline: "Accounts in good standing", detail: "Current platform user coverage" },
        { label: "Examinations", value: stats.data?.exams ?? "-", change: "Managed", headline: "Assessment pipeline active", detail: "Published and scheduled examinations" },
        { label: "Attempts", value: stats.data?.attempts ?? "-", change: "Tracked", headline: "Candidate sessions monitored", detail: "Server-controlled exam attempts" },
        { label: "Integrity Events", value: stats.data?.antiCheatEvents ?? "-", change: "Review", headline: "Anti-cheat signal visibility", detail: "Recorded monitoring activity", trend: "down" },
      ]

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards cards={cards} />
          <div className="grid gap-4 px-4 lg:grid-cols-[1.35fr_.85fr] lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>{space === "candidate" ? "Upcoming examinations" : "Operational readiness"}</CardTitle>
                <CardDescription>
                  {space === "candidate" ? "Assigned exams appear here when published by your examiner." : "ARGUS monitoring and protected submission services are available."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {space === "candidate" && exams.data?.length ? exams.data.map((exam) => (
                  <div key={exam.id ?? exam._id} className="flex items-center justify-between rounded-xl border bg-muted/25 p-4">
                    <div>
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-sm text-muted-foreground">{new Date(exam.startTime).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline">{exam.status}</Badge>
                  </div>
                )) : (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                    <IconShieldCheck className="size-5" />
                    {reportsAllowed || space === "candidate" ? "No urgent integrity alerts require action." : "Reporting access has not been assigned to your account."}
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
                <Button variant="outline" className="justify-start">
                  <IconCalendarTime /> Review scheduled exams
                </Button>
                <Button variant="outline" className="justify-start">
                  <IconShieldCheck /> View integrity monitoring
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
