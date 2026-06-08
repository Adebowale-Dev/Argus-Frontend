"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, RefreshCwIcon, ScanSearch } from "lucide-react"
import { toast } from "sonner"

import { ArgusMark } from "@/components/brand/argus-mark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { apiRequest, ApiRequestError } from "@/lib/api/client"

function resolvePrefilledCode(searchParams: URLSearchParams) {
  const explicitCode =
    searchParams.get("code") ??
    searchParams.get("examCode") ??
    searchParams.get("exam_code") ??
    ""

  if (explicitCode) {
    return explicitCode.trim().replace(/^AR/i, "").replace(/\D/g, "").slice(0, 4)
  }

  for (const [key] of searchParams.entries()) {
    if (/^ar\d{4}$/i.test(key.trim())) {
      return key.trim().replace(/^AR/i, "").slice(0, 4)
    }
  }

  return ""
}

function ExamEntryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [examCode, setExamCode] = useState<string | null>(null)
  const prefilledExamCode = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    return resolvePrefilledCode(params)
  }, [searchParams])
  const activeExamCode = examCode ?? prefilledExamCode

  const resolveCode = useMutation({
    mutationFn: (value: string) => apiRequest<{ slug: string; title: string }>("/public/exams/resolve-code", {
      method: "POST",
      body: JSON.stringify({ examCode: `AR${value}` }),
    }, { authenticated: false }).then((response) => response.data),
    onSuccess: (data) => router.push(`/exam/${data.slug}`),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = activeExamCode.trim().replace(/^AR/i, "").replace(/\D/g, "")
    if (trimmed.length !== 4) {
      toast.error("Enter the 4 digits that follow AR.")
      return
    }
    resolveCode.mutate(trimmed)
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.10),_transparent_28%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.35))] px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to landing page
        </Link>
        <Link href="/" className="w-fit">
          <ArgusMark />
        </Link>
        <div className="grid gap-6">
          <Card className="border-border/70 bg-card/92 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                <ScanSearch className="size-3.5" />
                Candidate exam finder
              </div>
              <CardTitle className="text-3xl">Enter your exam code</CardTitle>
              <CardDescription>Type the digits after <span className="font-semibold text-foreground">AR</span> to find your exam instantly. Public exams go straight to the required candidate form, while private exams verify your approved email first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={submitCode}>
                <FieldGroup>
                  <Field>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor="exam-code">Exam code</FieldLabel>
                      {prefilledExamCode ? (
                        <Button type="button" variant="outline" size="xs" onClick={() => setExamCode(prefilledExamCode)}>
                          <RefreshCwIcon />
                          Use shared code
                        </Button>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border bg-muted/25 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold tracking-[0.18em] text-primary-foreground">AR</span>
                        <span>Enter the four digits from your exam invite.</span>
                      </div>
                      <div className="flex w-full items-center gap-1.5 sm:gap-3">
                        {/* AR prefix — fixed, non-interactive */}
                        <div aria-hidden="true" className="flex items-center">
                          <InputOTP maxLength={2} value="AR" disabled>
                            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-10 *:data-[slot=input-otp-slot]:w-9 *:data-[slot=input-otp-slot]:text-sm *:data-[slot=input-otp-slot]:font-semibold sm:*:data-[slot=input-otp-slot]:h-14 sm:*:data-[slot=input-otp-slot]:w-12 sm:*:data-[slot=input-otp-slot]:text-lg">
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                            </InputOTPGroup>
                            <InputOTPSeparator className="ml-1 sm:ml-2" />
                          </InputOTP>
                        </div>

                        {/* 4-digit candidate input */}
                        <InputOTP
                          id="exam-code"
                          maxLength={4}
                          value={activeExamCode}
                          onChange={(value) => setExamCode(value.replace(/^AR/i, "").replace(/\D/g, "").slice(0, 4))}
                          pattern="^[0-9]+$"
                          required
                        >
                          <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-10 *:data-[slot=input-otp-slot]:w-9 *:data-[slot=input-otp-slot]:text-sm *:data-[slot=input-otp-slot]:font-semibold sm:*:data-[slot=input-otp-slot]:h-14 sm:*:data-[slot=input-otp-slot]:w-12 sm:*:data-[slot=input-otp-slot]:text-lg">
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                          </InputOTPGroup>
                          <InputOTPSeparator className="mx-1 sm:mx-2" />
                          <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-10 *:data-[slot=input-otp-slot]:w-9 *:data-[slot=input-otp-slot]:text-sm *:data-[slot=input-otp-slot]:font-semibold sm:*:data-[slot=input-otp-slot]:h-14 sm:*:data-[slot=input-otp-slot]:w-12 sm:*:data-[slot=input-otp-slot]:text-lg">
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <FieldDescription>
                      Shared link support works for both <span className="font-medium text-foreground">/exam?code=AR1214</span> and shorthand invite links like <span className="font-medium text-foreground">/exam?ar1214</span>.
                    </FieldDescription>
                  </Field>
                  <Button type="submit" size="lg" disabled={resolveCode.isPending}>
                    {resolveCode.isPending ? "Finding exam..." : "Find exam"}
                    <ArrowRight className="size-4" />
                  </Button>
                </FieldGroup>
              </form>
              <div className="rounded-2xl border bg-muted/35 p-4 text-sm text-muted-foreground">
                Your lecturer or examiner shares the branded exam code like <span className="font-medium text-foreground">AR1214</span>. Private exams may then verify your approved email before you continue.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function ExamEntryPage() {
  return (
    <Suspense fallback={<main className="min-h-svh bg-background px-4 py-10"><div className="mx-auto max-w-5xl text-sm text-muted-foreground">Loading exam finder...</div></main>}>
      <ExamEntryContent />
    </Suspense>
  )
}
