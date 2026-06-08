"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { IconArrowLeft, IconShieldCheck, IconUser } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { ExamPageShell, PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/lib/api/client"
import { getExamSession, setExamSession } from "@/lib/exam-session"
import type { PublicExamInfo } from "./exam-landing"

type CustomField = NonNullable<PublicExamInfo["candidateIdentityRequirements"]["customFields"]>[number]

export function ExamDetails({ examCode }: { examCode: string }) {
  const router = useRouter()
  const code = examCode.toUpperCase()

  // Guard: must be verified to reach this page
  useEffect(() => {
    const s = getExamSession(code)
    if (!s.examAccessToken && !s.emailVerificationToken) {
      router.replace(`/exam/${code.toLowerCase()}/verify`)
    }
  }, [code, router])

  const examQuery = useQuery({
    queryKey: ["public-exam", code],
    queryFn: () => apiRequest<PublicExamInfo>(`/public/exams/${code}`, {}, { authenticated: false }).then((r) => r.data),
  })

  const session = getExamSession(code)
  const verifiedEmail = session.verifiedEmail ?? ""

  const [form, setForm] = useState<Record<string, string>>({
    fullName: session.candidateInfo?.fullName ?? "",
    email: session.candidateInfo?.email ?? verifiedEmail,
    phone: session.candidateInfo?.phone ?? "",
    identifier: session.candidateInfo?.identifier ?? "",
    ...(session.candidateInfo?.metadata ?? {}),
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const exam = examQuery.data
    if (!exam) return

    const req = exam.candidateIdentityRequirements
    if (req.fullName && !form.fullName?.trim()) { toast.error("Full name is required."); return }
    if (req.email && !form.email?.trim()) { toast.error("Email address is required."); return }
    if (req.phone && !form.phone?.trim()) { toast.error("Phone number is required."); return }
    if (req.identifier && !form.identifier?.trim()) { toast.error("Candidate ID is required."); return }

    for (const field of req.customFields ?? []) {
      if (field.required && !form[`custom:${field.key}`]?.trim()) {
        toast.error(`${field.label} is required.`)
        return
      }
    }

    // Build metadata from custom fields
    const metadata: Record<string, string> = {}
    for (const field of req.customFields ?? []) {
      metadata[field.key] = form[`custom:${field.key}`] ?? ""
    }

    setExamSession(code, {
      candidateInfo: {
        fullName: form.fullName?.trim(),
        email: form.email?.trim() || verifiedEmail,
        phone: form.phone?.trim(),
        identifier: form.identifier?.trim(),
        metadata,
      },
    })

    router.push(`/exam/${code.toLowerCase()}/start`)
  }

  if (examQuery.isPending) {
    return (
      <PublicExamLayout step="details">
        <ExamPageShell>
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  const exam = examQuery.data
  if (!exam) return null

  const req = exam.candidateIdentityRequirements

  return (
    <PublicExamLayout step="details">
      <ExamPageShell>
        <Link
          href={`/exam/${code.toLowerCase()}/verify`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" /> Back
        </Link>

        <div className="rounded-2xl border bg-white shadow-sm dark:bg-card">
          <div className="border-b px-6 py-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <IconUser className="size-5 text-primary" />
            </div>
            <h1 className="mt-3 text-xl font-bold">Candidate Details</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Please provide the required information before starting your exam.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            {/* Verified email notice */}
            {verifiedEmail && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <IconShieldCheck className="size-4 shrink-0 text-emerald-600" />
                <span className="text-emerald-800 dark:text-emerald-300">
                  Verified email: <strong>{verifiedEmail}</strong>
                </span>
              </div>
            )}

            {/* Full name */}
            {req.fullName && (
              <FormField
                label="Full Name"
                required
                value={form.fullName ?? ""}
                onChange={(v) => set("fullName", v)}
                placeholder="John Doe"
              />
            )}

            {/* Email — locked if already verified via OTP */}
            {req.email && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={verifiedEmail || form.email || ""}
                  onChange={(e) => !verifiedEmail && set("email", e.target.value)}
                  readOnly={!!verifiedEmail}
                  className={verifiedEmail ? "cursor-not-allowed bg-muted/50 text-muted-foreground" : ""}
                  placeholder="you@example.com"
                  required
                />
                {verifiedEmail && (
                  <p className="mt-1 text-xs text-muted-foreground">Email is locked because it was verified in the previous step.</p>
                )}
              </div>
            )}

            {/* Phone */}
            {req.phone && (
              <FormField
                label="Phone Number"
                type="tel"
                value={form.phone ?? ""}
                onChange={(v) => set("phone", v)}
                placeholder="+1 000 000 0000"
              />
            )}

            {/* Candidate ID */}
            {req.identifier && (
              <FormField
                label="Candidate ID / Applicant Number"
                required
                value={form.identifier ?? ""}
                onChange={(v) => set("identifier", v)}
                placeholder="e.g. APP-001"
              />
            )}

            {/* Custom fields */}
            {(req.customFields ?? []).length > 0 && (
              <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Additional information required
                </p>
                {req.customFields!.map((field: CustomField) => (
                  <FormField
                    key={field.key}
                    label={field.label}
                    type={field.type}
                    required={field.required}
                    value={form[`custom:${field.key}`] ?? ""}
                    onChange={(v) => set(`custom:${field.key}`, v)}
                    placeholder={field.placeholder}
                  />
                ))}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full">
              Continue
            </Button>
          </form>
        </div>
      </ExamPageShell>
    </PublicExamLayout>
  )
}

function FormField({
  label, type = "text", required, value, onChange, placeholder,
}: {
  label: string; type?: string; required?: boolean; value: string
  onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}
