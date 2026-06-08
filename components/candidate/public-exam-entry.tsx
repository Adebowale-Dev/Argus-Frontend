"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { IconClock, IconLock, IconShieldCheck } from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { ExamDeviceBlocked, useExamDeviceBlocked } from "@/components/candidate/exam-device-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { apiRequest, ApiRequestError, setAttemptToken } from "@/lib/api/client"
import type { AttemptSession } from "@/lib/api/types"
import { toastInvalidField } from "@/lib/form-validation"

type Landing = {
  code?: string
  title: string
  description?: string
  instructions?: string
  durationMinutes: number
  questionCount: number
  totalMarks: number
  passMark?: number
  canStart: boolean
  status: string
  candidateIdentityRequirements: {
    fullName: boolean
    email: boolean
    phone: boolean
    identifier: boolean
    customFields?: Array<{ key: string; label: string; type: "text" | "email" | "tel" | "number"; placeholder?: string; required?: boolean }>
  }
  antiCheatSummary: { requiresFullscreen: boolean; detectsTabSwitching: boolean; blocksCopyPaste: boolean; webcamRequired: boolean; autoSubmitEnabled: boolean }
  accessCodeRequired?: boolean
  emailVerificationRequired?: boolean
}
type CustomField = NonNullable<Landing["candidateIdentityRequirements"]["customFields"]>[number]

const optionalValue = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim()
  return normalized ? normalized : undefined
}

export function PublicExamEntry({ slug }: { slug: string }) {
  const router = useRouter()
  const blockedDevice = useExamDeviceBlocked()
  const [verifiedEmail, setVerifiedEmail] = useState("")
  const [emailVerificationToken, setEmailVerificationToken] = useState("")
  const landing = useQuery({ queryKey: ["public-exam", slug], queryFn: () => apiRequest<Landing>(`/public/exams/${slug}`, {}, { authenticated: false }).then((response) => response.data) })
  const requestEmailOtp = useMutation({
    mutationFn: (email: string) => apiRequest<{ email: string; expiresIn: string; devVerificationCode?: string }>(`/public/exams/${slug}/request-email-otp`, { method: "POST", body: JSON.stringify({ email }) }, { authenticated: false }).then((response) => response.data),
    onSuccess: (data) => {
      setVerifiedEmail(data.email)
      toast.success(data.devVerificationCode ? "Verification code generated for local development." : "Verification code sent to your email.")
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const verifyEmailOtp = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) => apiRequest<{ emailVerificationToken: string; email: string }>(`/public/exams/${slug}/verify-email-otp`, { method: "POST", body: JSON.stringify({ email, otp }) }, { authenticated: false }).then((response) => response.data),
    onSuccess: (data) => {
      setVerifiedEmail(data.email)
      setEmailVerificationToken(data.emailVerificationToken)
      toast.success("Email verified. Complete your details to begin.")
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const start = useMutation({
    mutationFn: (form: FormData) => {
      const metadata = Object.fromEntries(
        (exam.candidateIdentityRequirements.customFields ?? [])
          .map((field: CustomField) => [field.key, optionalValue(form.get(`custom:${field.key}`))])
          .filter(([, value]) => value !== undefined),
      )

      return apiRequest<AttemptSession>(`/public/exams/${slug}/start`, {
        method: "POST",
        body: JSON.stringify({
          ...(emailVerificationToken ? { emailVerificationToken } : {}),
          candidate: {
            ...(optionalValue(form.get("fullName")) ? { fullName: optionalValue(form.get("fullName")) } : {}),
            ...((verifiedEmail || optionalValue(form.get("email"))) ? { email: (verifiedEmail || optionalValue(form.get("email")) || "").trim() } : {}),
            ...(optionalValue(form.get("phone")) ? { phone: optionalValue(form.get("phone")) } : {}),
            ...(optionalValue(form.get("identifier")) ? { identifier: optionalValue(form.get("identifier")) } : {}),
            ...(Object.keys(metadata).length ? { metadata } : {}),
          },
          acceptedTerms: form.get("acceptedTerms") === "on",
          deviceInfo: { userAgent: navigator.userAgent },
          browserFingerprint: `${navigator.userAgent}-${screen.width}x${screen.height}`,
        }),
      }, { authenticated: false }).then((response) => response.data)
    },
    onSuccess: (session) => {
      const id = session.attempt.id ?? session.attempt._id
      if (id && session.attemptToken) setAttemptToken(id, session.attemptToken)
      toast.success("Secure exam attempt started.")
      router.push(`/candidate/attempts/${id}`)
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  if (landing.isLoading) return <main className="mx-auto flex min-h-svh max-w-4xl items-center px-6">Loading exam...</main>
  if (!landing.data) return <main className="mx-auto flex min-h-svh max-w-4xl items-center px-6">Exam not found.</main>
  if (blockedDevice) return <main className="min-h-svh bg-muted/40"><ExamDeviceBlocked returnHref="/exam" returnLabel="Return to exam finder" /></main>

  const exam = landing.data
  const requirements = exam.candidateIdentityRequirements
  const verificationStep = !exam.emailVerificationRequired ? "details" : emailVerificationToken ? "details" : verifiedEmail ? "otp" : "request"
  const verificationComplete = verificationStep === "details"

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/exam" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to exam finder
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            {exam.code && <Badge className="w-fit" variant="outline">{exam.code}</Badge>}
            <Badge className="w-fit" variant={exam.canStart ? "default" : "secondary"}>{exam.status}</Badge>
            <CardTitle className="text-3xl">{exam.title}</CardTitle>
            <CardDescription>{exam.description || "Secure online assessment powered by ARGUS."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info icon={<IconClock />} label="Duration" value={`${exam.durationMinutes} minutes`} />
              <Info icon={<IconShieldCheck />} label="Questions" value={`${exam.questionCount}`} />
              <Info icon={<IconLock />} label="Marks" value={`${exam.totalMarks}`} />
            </div>
            <Separator />
            <section className="space-y-2"><h2 className="font-semibold">Instructions</h2><p className="whitespace-pre-line text-sm text-muted-foreground">{exam.instructions}</p></section>
            <section className="space-y-2"><h2 className="font-semibold">Anti-cheat summary</h2><div className="flex flex-wrap gap-2">{Object.entries(exam.antiCheatSummary).filter(([, enabled]) => enabled).map(([key]) => <Badge key={key} variant="outline">{key.replace(/([A-Z])/g, " $1")}</Badge>)}</div></section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enter Exam</CardTitle><CardDescription>{exam.emailVerificationRequired ? "Step 1: verify your approved email. Step 2: provide the lecturer-required details. Step 3: launch the secure session." : "Complete the lecturer-required details below to begin your exam."}</CardDescription></CardHeader>
          <CardContent>
            {!exam.canStart ? (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                You can complete verification now, but the secure session will only start once this exam becomes available.
              </div>
            ) : null}
            {!verificationComplete && exam.emailVerificationRequired ? (
              verificationStep === "request" ? (
                <form onInvalidCapture={toastInvalidField} onSubmit={(event) => { event.preventDefault(); requestEmailOtp.mutate(String(new FormData(event.currentTarget).get("email") ?? "")) }}>
                  <FieldGroup>
                    <Field><FieldLabel>Approved student email</FieldLabel><Input name="email" type="email" required data-label="Approved student email" /></Field>
                    <Button type="submit" disabled={requestEmailOtp.isPending}>
                      {requestEmailOtp.isPending ? "Sending code..." : "Send verification code"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </FieldGroup>
                </form>
              ) : (
                <form onInvalidCapture={toastInvalidField} onSubmit={(event) => { event.preventDefault(); verifyEmailOtp.mutate({ email: verifiedEmail, otp: String(new FormData(event.currentTarget).get("otp") ?? "") }) }}>
                  <FieldGroup>
                    <div className="rounded-2xl border bg-muted/25 p-4 text-sm text-muted-foreground">We sent a 6-digit code to <span className="font-medium text-foreground">{verifiedEmail}</span>.</div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedEmail("")
                        setEmailVerificationToken("")
                        requestEmailOtp.reset()
                        verifyEmailOtp.reset()
                      }}
                      className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Use a different email
                    </button>
                    {requestEmailOtp.data?.devVerificationCode ? (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        Email sending is disabled in local development. Use this verification code: <span className="font-mono font-semibold">{requestEmailOtp.data.devVerificationCode}</span>
                      </div>
                    ) : null}
                    <Field><FieldLabel>Email verification code</FieldLabel><Input name="otp" inputMode="numeric" maxLength={6} required data-label="Email verification code" /></Field>
                    <Button type="submit" disabled={verifyEmailOtp.isPending}>
                      {verifyEmailOtp.isPending ? "Verifying..." : "Verify email"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </FieldGroup>
                </form>
              )
            ) : (
              <form onInvalidCapture={toastInvalidField} onSubmit={(event) => { event.preventDefault(); start.mutate(new FormData(event.currentTarget)) }}>
                <FieldGroup>
                  <div className="rounded-2xl border bg-muted/25 p-4 text-sm text-muted-foreground">
                    These details are required so your submission can be matched correctly in the examiner&apos;s report and anti-cheat timeline.
                  </div>
                  {verifiedEmail ? <div className="rounded-2xl border bg-primary/5 p-4 text-sm text-primary">Verified email: {verifiedEmail}</div> : null}
                  {requirements.fullName && <Field><FieldLabel>Full name</FieldLabel><Input name="fullName" required data-label="Full name" /></Field>}
                  {requirements.email && !verifiedEmail && <Field><FieldLabel>Email address</FieldLabel><Input name="email" type="email" required data-label="Email address" /></Field>}
                  {requirements.phone && <Field><FieldLabel>Phone number</FieldLabel><Input name="phone" required data-label="Phone number" /></Field>}
                  {requirements.identifier && <Field><FieldLabel>ID / applicant number</FieldLabel><Input name="identifier" required data-label="ID / applicant number" /></Field>}
                  {requirements.customFields?.length ? (
                    <div className="space-y-4 rounded-2xl border p-4">
                      <div>
                        <p className="font-medium">Additional lecturer-requested details</p>
                        <p className="text-sm text-muted-foreground">Complete every field marked as required before the secure session can begin.</p>
                      </div>
                      {requirements.customFields.map((field: CustomField) => <Field key={field.key}><FieldLabel>{field.label}</FieldLabel><Input name={`custom:${field.key}`} type={field.type} placeholder={field.placeholder} required={field.required} data-label={field.label} /></Field>)}
                    </div>
                  ) : null}
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm"><input name="acceptedTerms" type="checkbox" required className="mt-1" /> I accept the exam rules and anti-cheat monitoring policy.</label>
                  <Button type="submit" disabled={start.isPending || !exam.canStart}>
                    {start.isPending ? "Starting..." : "Start secure exam"}
                    <ArrowRight className="size-4" />
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </main>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-3 text-sm">{<span className="mb-2 block size-5 text-muted-foreground">{icon}</span>}<div className="text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>
}
