"use client"

import Link from "next/link"
import { ArgusMark } from "@/components/brand/argus-mark"

// Step ids used by sub-pages to highlight the progress bar
export type ExamFlowStep = "landing" | "verify" | "details" | "start" | "attempt" | "submitted" | "result"

const FLOW_STEPS: Array<{ id: ExamFlowStep; label: string }> = [
  { id: "landing",   label: "Exam Info" },
  { id: "verify",    label: "Verify" },
  { id: "details",   label: "Your Details" },
  { id: "start",     label: "Rules" },
  { id: "attempt",   label: "Exam" },
  { id: "submitted", label: "Submitted" },
]

export function PublicExamLayout({
  children,
  step,
  hideSteps = false,
}: {
  children: React.ReactNode
  step?: ExamFlowStep
  hideSteps?: boolean
}) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.id === step)

  return (
    <div className="flex min-h-svh flex-col bg-[#f8f9fc] dark:bg-[#0d0f14]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-white/90 backdrop-blur dark:bg-[#111318]/90">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/exam" className="select-none transition-opacity hover:opacity-90">
            <ArgusMark compact className="gap-2" />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">Secure Examination Platform</span>
        </div>

        {/* Step progress bar */}
        {!hideSteps && step && step !== "result" && (
          <div className="border-t border-border/40 bg-white/60 dark:bg-[#111318]/60">
            <div className="mx-auto flex max-w-5xl items-center overflow-x-auto px-4">
              {FLOW_STEPS.map((s, i) => {
                const done = activeIdx > i
                const active = activeIdx === i
                return (
                  <div key={s.id} className="flex items-center">
                    <div className={`flex items-center gap-1.5 whitespace-nowrap py-2.5 text-xs font-medium transition-colors ${
                      active ? "text-primary" : done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                    }`}>
                      <span className={`flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                        active ? "bg-primary/15 text-primary" :
                        "bg-muted/60 text-muted-foreground/50"
                      }`}>
                        {done ? "✓" : i + 1}
                      </span>
                      {s.label}
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <span className={`mx-2 h-px w-6 shrink-0 ${done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border/50"}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex flex-1 flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground/60">
        ARGUS Secure Examination Platform &mdash; All activity is monitored and logged.
      </footer>
    </div>
  )
}

// ─── Reusable page shell for centered card pages ──────────────────────────────
export function ExamPageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-xl px-4 py-10 ${className}`}>
      {children}
    </div>
  )
}
