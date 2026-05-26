"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
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
}
type CustomField = NonNullable<Landing["candidateIdentityRequirements"]["customFields"]>[number]

export function PublicExamEntry({ slug }: { slug: string }) {
  const router = useRouter()
  const blockedDevice = useExamDeviceBlocked()
  const landing = useQuery({ queryKey: ["public-exam", slug], queryFn: () => apiRequest<Landing>(`/public/exams/${slug}`, {}, { authenticated: false }).then((response) => response.data) })
  const verify = useMutation({
    mutationFn: (accessCode: string) => apiRequest<{ examAccessToken: string; expiresIn: string }>(`/public/exams/${slug}/verify-code`, { method: "POST", body: JSON.stringify({ accessCode }) }, { authenticated: false }).then((response) => response.data),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const start = useMutation({
    mutationFn: (form: FormData) => apiRequest<AttemptSession>(`/public/exams/${slug}/start`, {
      method: "POST",
      body: JSON.stringify({
        examAccessToken: verify.data?.examAccessToken,
        candidate: {
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          identifier: String(form.get("identifier") ?? ""),
          metadata: Object.fromEntries((exam.candidateIdentityRequirements.customFields ?? []).map((field: CustomField) => [field.key, String(form.get(`custom:${field.key}`) ?? "")])),
        },
        acceptedTerms: form.get("acceptedTerms") === "on",
        deviceInfo: { userAgent: navigator.userAgent },
        browserFingerprint: `${navigator.userAgent}-${screen.width}x${screen.height}`,
      }),
    }, { authenticated: false }).then((response) => response.data),
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
          <CardHeader><CardTitle>Enter Exam</CardTitle><CardDescription>Step 1: verify the 6-digit code. Step 2: provide the details your lecturer requested. Step 3: launch the secure session.</CardDescription></CardHeader>
          <CardContent>
            {!verify.data ? (
              <form onSubmit={(event) => { event.preventDefault(); verify.mutate(String(new FormData(event.currentTarget).get("accessCode") ?? "")) }}>
                <FieldGroup>
                  <Field><FieldLabel>6-digit access code</FieldLabel><Input name="accessCode" inputMode="numeric" maxLength={6} required /></Field>
                  <Button disabled={verify.isPending || !exam.canStart}>
                    {verify.isPending ? "Verifying..." : "Verify code"}
                    <ArrowRight className="size-4" />
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); start.mutate(new FormData(event.currentTarget)) }}>
                <FieldGroup>
                  <div className="rounded-2xl border bg-muted/25 p-4 text-sm text-muted-foreground">
                    These details are required so your submission can be matched correctly in the examiner&apos;s report and anti-cheat timeline.
                  </div>
                  {requirements.fullName && <Field><FieldLabel>Full name</FieldLabel><Input name="fullName" required /></Field>}
                  {requirements.email && <Field><FieldLabel>Email address</FieldLabel><Input name="email" type="email" required /></Field>}
                  {requirements.phone && <Field><FieldLabel>Phone number</FieldLabel><Input name="phone" required /></Field>}
                  {requirements.identifier && <Field><FieldLabel>ID / applicant number</FieldLabel><Input name="identifier" required /></Field>}
                  {requirements.customFields?.length ? (
                    <div className="space-y-4 rounded-2xl border p-4">
                      <div>
                        <p className="font-medium">Additional lecturer-requested details</p>
                        <p className="text-sm text-muted-foreground">Complete every field marked as required before the secure session can begin.</p>
                      </div>
                      {requirements.customFields.map((field: CustomField) => <Field key={field.key}><FieldLabel>{field.label}</FieldLabel><Input name={`custom:${field.key}`} type={field.type} placeholder={field.placeholder} required={field.required} /></Field>)}
                    </div>
                  ) : null}
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm"><input name="acceptedTerms" type="checkbox" required className="mt-1" /> I accept the exam rules and anti-cheat monitoring policy.</label>
                  <Button disabled={start.isPending}>
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
