"use client"

import Link from "next/link"
import { IconArrowRight, IconCalendarTime, IconIdBadge2, IconShieldCheck } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest } from "@/lib/api/client"
import type { Exam } from "@/lib/api/types"

export function AssignedExams() {
  const exams = useQuery({ queryKey: ["candidate", "all-exams"], queryFn: () => apiRequest<Exam[]>("/candidate/exams?limit=50").then((response) => response.data) })
  const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : "Always open"

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading title="Assigned Exams" description="Every exam assigned to your account appears here automatically with its secure start path." />
      <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
        {!exams.data?.length ? <div className="md:col-span-2 xl:col-span-3"><EmptyState message="No published examinations are assigned to you." /></div> : exams.data.map((exam) => (
          <Card key={entityId(exam)} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{exam.title}</CardTitle>
                <StatusBadge status={exam.status} />
              </div>
              <CardDescription>{exam.description ?? "Secure ARGUS examination for your assigned workspace."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><IconIdBadge2 className="size-4" /> {exam.code ?? "Code pending"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><IconCalendarTime className="size-4" /> {formatDate(exam.startTime)}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><IconShieldCheck className="size-4" /> {exam.durationMinutes} minutes protected session</div>
              </div>
              <Button asChild className="w-full"><Link href={`/candidate/exams/${entityId(exam)}`}><IconArrowRight /> Review instructions and start</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
