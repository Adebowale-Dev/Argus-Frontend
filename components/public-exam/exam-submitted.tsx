"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { IconCheck, IconClockOff, IconShieldCheck } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { getExamSession } from "@/lib/exam-session"

export function ExamSubmitted({ examCode }: { examCode: string }) {
  const params = useSearchParams()
  const auto = params.get("auto") === "true"
  const code = examCode.toUpperCase()
  const session = getExamSession(code)

  return (
    <PublicExamLayout step="submitted" hideSteps>
      <div className="flex min-h-[calc(100svh-80px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div className={`mx-auto flex size-20 items-center justify-center rounded-3xl ${auto ? "bg-amber-100 dark:bg-amber-950/30" : "bg-emerald-100 dark:bg-emerald-950/30"}`}>
            {auto
              ? <IconClockOff className="size-10 text-amber-600" />
              : <IconCheck className="size-10 text-emerald-600" />
            }
          </div>

          {/* Heading */}
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            {auto ? "Exam Auto-Submitted" : "Exam Submitted"}
          </h1>

          {/* Message */}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {auto
              ? "Your exam was automatically submitted because the anti-cheat violation limit was exceeded. Your saved answers have been recorded."
              : "Your answers have been submitted successfully. The examiner will review your responses."}
          </p>

          {/* Candidate info */}
          {session.candidateInfo?.fullName && (
            <p className="mt-4 text-sm text-muted-foreground">
              Submitted as <strong className="text-foreground">{session.candidateInfo.fullName}</strong>
            </p>
          )}

          {/* Auto note */}
          {auto && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left dark:border-amber-900/40 dark:bg-amber-950/20">
              <IconClockOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                All exam activity and violations have been logged. The examiner can review the full activity report.
              </p>
            </div>
          )}

          {/* ARGUS note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <IconShieldCheck className="size-3.5 text-primary" />
            <span>Secured and monitored by ARGUS</span>
          </div>

          {/* Result link (if attemptId stored) */}
          {session.attemptId && (
            <div className="mt-8 space-y-3">
              <Link href={`/exam/${code.toLowerCase()}/result`}>
                <Button variant="outline" className="w-full">View Results</Button>
              </Link>
            </div>
          )}

          <div className="mt-4">
            <Link href="/exam" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Return to exam finder
            </Link>
          </div>
        </div>
      </div>
    </PublicExamLayout>
  )
}
