"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { IconArrowLeft, IconClock, IconMaximize, IconShieldCheck } from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeading, entityId } from "@/components/workspace/page-elements"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest, ApiRequestError } from "@/lib/api/client"
import type { AttemptSession, Exam } from "@/lib/api/types"

export function ExamInstructions() {
  const router = useRouter()
  const { examId } = useParams<{ examId: string }>()
  const instructions = useQuery({ queryKey: ["candidate", "instructions", examId], queryFn: () => apiRequest<Exam>(`/candidate/exams/${examId}/instructions`).then((response) => response.data) })
  const start = useMutation({
    mutationFn: () => apiRequest<AttemptSession>(`/exams/${examId}/start`, {
      method: "POST",
      body: JSON.stringify({ deviceInfo: { platform: navigator.platform, userAgent: navigator.userAgent } }),
    }),
    onSuccess: async (response) => {
      if (instructions.data?.antiCheatSettings?.requireFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => undefined)
      }
      toast.success("Your exam attempt has started.")
      router.push(`/candidate/attempts/${entityId(response.data.attempt)}`)
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const exam = instructions.data

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading title={exam?.title ?? "Exam Instructions"} description="Read carefully before the server opens your fullscreen, timed attempt." />
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 lg:grid-cols-[1fr_.7fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Instructions</CardTitle>
                <CardDescription>Attempt rules from your examiner.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/candidate/exams"><IconArrowLeft /> Back to assigned exams</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-7">{exam?.instructions ?? "Follow examination rules and remain on this page until you submit."}</CardContent>
        </Card>
        <div className="space-y-4">
          <Card><CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center gap-2"><IconClock className="size-4" /> Duration: {exam?.durationMinutes ?? "-"} minutes</div>
            <div>Window opens: {exam?.startTime ? new Date(exam.startTime).toLocaleString() : "Always open"}</div>
            <div>Window closes: {exam?.endTime ? new Date(exam.endTime).toLocaleString() : "Closes manually"}</div>
            <div className="flex items-center gap-2"><IconMaximize className="size-4" /> Fullscreen mode is requested before your attempt begins.</div>
          </CardContent></Card>
          <Alert><IconShieldCheck /><AlertTitle>Monitoring enabled</AlertTitle><AlertDescription>Leaving fullscreen, changing tabs, copy/paste, or focus loss may trigger warnings or automatic submission.</AlertDescription></Alert>
          <Button size="lg" className="w-full" disabled={!exam || start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Starting..." : "Start examination"}</Button>
        </div>
      </div>
    </div>
  )
}
