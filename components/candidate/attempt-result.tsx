"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { IconRosetteDiscountCheck } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest } from "@/lib/api/client"

type Result = { pending?: boolean; message?: string; score?: number; totalMarks?: number; percentage?: number; passed?: boolean; status?: string }

export function AttemptResult() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const result = useQuery({ queryKey: ["attempt", attemptId, "result"], queryFn: () => apiRequest<Result>(`/attempts/${attemptId}/result`).then((response) => response.data) })

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 py-10 lg:p-6">
      <Card>
        <CardHeader className="items-center text-center">
          <IconRosetteDiscountCheck className="size-12 text-primary" />
          <CardTitle>Examination submitted</CardTitle>
          <CardDescription>Your answers have been received securely by ARGUS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          {result.data?.pending ? <p className="rounded-lg bg-muted p-4 text-sm">{result.data.message}</p> : result.data && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3"><div className="text-2xl font-semibold">{result.data.score}</div><div className="text-xs text-muted-foreground">Score</div></div>
              <div className="rounded-lg border p-3"><div className="text-2xl font-semibold">{result.data.percentage}%</div><div className="text-xs text-muted-foreground">Percentage</div></div>
              <div className="rounded-lg border p-3"><div className="text-lg font-semibold">{result.data.passed ? "Passed" : "Failed"}</div><div className="text-xs text-muted-foreground">Result</div></div>
            </div>
          )}
          <Button asChild variant="outline"><Link href="/candidate/exams">Return to assigned exams</Link></Button>
        </CardContent>
      </Card>
    </div>
  )
}
