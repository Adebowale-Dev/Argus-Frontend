"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  IconArrowLeft,
  IconCheck,
  IconLock,
  IconMail,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { ExamPageShell, PublicExamLayout } from "@/components/public-exam/public-exam-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest, ApiRequestError } from "@/lib/api/client"
import { getExamSession, setExamSession } from "@/lib/exam-session"
import type { PublicExamInfo } from "./exam-landing"

type VerifyCodeResponse = {
  examAccessToken: string
  accessMode: string
  expiresIn?: string
}
type RequestOtpResponse = {
  email: string
  expiresIn?: string
  devVerificationCode?: string
}
type VerifyOtpResponse = {
  emailVerificationToken: string
  email: string
}

type VerifyPhase = "access-code" | "email-entry" | "email-otp"

export function ExamVerify({ examCode }: { examCode: string }) {
  const router = useRouter()
  const code = examCode.toUpperCase()

  const examQuery = useQuery({
    queryKey: ["public-exam", code],
    queryFn: () => apiRequest<PublicExamInfo>(`/public/exams/${code}`, {}, { authenticated: false }).then((r) => r.data),
    retry: 1,
  })

  // Resume from session if already verified
  useEffect(() => {
    const s = getExamSession(code)
    if (s.examAccessToken || s.emailVerificationToken) {
      router.replace(`/exam/${code.toLowerCase()}/details`)
    }
  }, [code, router])

  // Determine phase: if exam requires email verification only (no access code), skip to email
  const exam = examQuery.data
  const requiresAccessCode = exam?.accessCodeRequired !== false
  const requiresEmail = exam?.emailVerificationRequired === true

  const [phase, setPhase] = useState<VerifyPhase>("access-code")
  const [accessCodeInput, setAccessCodeInput] = useState(code) // pre-fill with the code from URL
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [resendCountdown, setResendCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown(seconds = 60) {
    setResendCountdown(seconds)
    countdownRef.current && clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  // Skip to email phase if no access code required
  useEffect(() => {
    if (exam && !requiresAccessCode && requiresEmail) setPhase("email-entry")
  }, [exam, requiresAccessCode, requiresEmail])

  const verifyCodeMutation = useMutation({
    mutationFn: (accessCode: string) =>
      apiRequest<VerifyCodeResponse>(
        `/public/exams/${code}/verify-code`,
        { method: "POST", body: JSON.stringify({ accessCode }) },
        { authenticated: false },
      ).then((r) => r.data),
    onSuccess: (data) => {
      setExamSession(code, { examAccessToken: data.examAccessToken, accessMode: data.accessMode })
      if (requiresEmail) {
        setPhase("email-entry")
      } else {
        router.push(`/exam/${code.toLowerCase()}/details`)
      }
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const requestOtpMutation = useMutation({
    mutationFn: (emailAddr: string) =>
      apiRequest<RequestOtpResponse>(
        `/public/exams/${code}/request-email-otp`,
        {
          method: "POST",
          body: JSON.stringify({
            email: emailAddr,
            examAccessToken: getExamSession(code).examAccessToken,
          }),
        },
        { authenticated: false },
      ).then((r) => r.data),
    onSuccess: (data) => {
      setOtpEmail(data.email)
      setPhase("email-otp")
      startCountdown(60)
      if (data.devVerificationCode) {
        toast.info(`Dev mode — OTP: ${data.devVerificationCode}`, { duration: 30000 })
      } else {
        toast.success(`Verification code sent to ${data.email}`)
      }
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: ({ emailAddr, code: otpCode }: { emailAddr: string; code: string }) =>
      apiRequest<VerifyOtpResponse>(
        `/public/exams/${code}/verify-email-otp`,
        {
          method: "POST",
          body: JSON.stringify({
            email: emailAddr,
            otp: otpCode,
            examAccessToken: getExamSession(code).examAccessToken,
          }),
        },
        { authenticated: false },
      ).then((r) => r.data),
    onSuccess: (data) => {
      setExamSession(code, { emailVerificationToken: data.emailVerificationToken, verifiedEmail: data.email })
      toast.success("Email verified. Continue to fill in your details.")
      router.push(`/exam/${code.toLowerCase()}/details`)
    },
    onError: (e: ApiRequestError) => toast.error(e.message),
  })

  if (examQuery.isPending) {
    return (
      <PublicExamLayout step="verify">
        <ExamPageShell>
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        </ExamPageShell>
      </PublicExamLayout>
    )
  }

  return (
    <PublicExamLayout step="verify">
      <ExamPageShell>
        <Link
          href={`/exam/${code.toLowerCase()}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" /> Back to exam info
        </Link>

        {exam && (
          <p className="mb-5 truncate text-xs font-medium text-muted-foreground">{exam.title}</p>
        )}

        {/* ── Phase: Access Code ── */}
        {phase === "access-code" && (
          <div className="rounded-2xl border bg-white shadow-sm dark:bg-card">
            <div className="border-b px-6 py-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <IconLock className="size-5 text-primary" />
              </div>
              <h1 className="mt-3 text-xl font-bold">Verify Access Code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the access code provided by your examiner.
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={(e) => {
                e.preventDefault()
                const val = accessCodeInput.trim().toUpperCase()
                if (!val) { toast.error("Enter the access code."); return }
                verifyCodeMutation.mutate(val)
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium">Access code</label>
                <Input
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. AR1214"
                  className="font-mono text-lg tracking-widest"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Your access code looks like <span className="font-mono font-medium text-foreground">AR1214</span> — it was provided with your exam invite.
                </p>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={verifyCodeMutation.isPending || !accessCodeInput.trim()}
              >
                {verifyCodeMutation.isPending ? "Verifying…" : "Verify Code"}
              </Button>
            </form>
          </div>
        )}

        {/* ── Phase: Email Entry ── */}
        {phase === "email-entry" && (
          <div className="rounded-2xl border bg-white shadow-sm dark:bg-card">
            <div className="border-b px-6 py-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <IconMail className="size-5 text-blue-600" />
              </div>
              <h1 className="mt-3 text-xl font-bold">Enter Your Email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This exam is restricted to invited candidates. Enter the email address your examiner added to the exam.
              </p>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={(e) => {
                e.preventDefault()
                if (!email.trim()) { toast.error("Enter your email."); return }
                requestOtpMutation.mutate(email.trim().toLowerCase())
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  autoFocus
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={requestOtpMutation.isPending || !email.trim()}
              >
                {requestOtpMutation.isPending ? "Sending…" : "Send Verification Code"}
              </Button>
            </form>
          </div>
        )}

        {/* ── Phase: Email OTP ── */}
        {phase === "email-otp" && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white shadow-sm dark:bg-card">
              <div className="border-b px-6 py-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <IconMail className="size-5 text-blue-600" />
                </div>
                <h1 className="mt-3 text-xl font-bold">Check Your Email</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a 6-digit verification code to{" "}
                  <strong className="text-foreground">{otpEmail}</strong>.
                </p>
              </div>
              <form
                className="space-y-4 px-6 py-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (otp.trim().length < 4) { toast.error("Enter the verification code from your email."); return }
                  verifyOtpMutation.mutate({ emailAddr: otpEmail, code: otp.trim() })
                }}
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Verification code</label>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="font-mono text-2xl tracking-[0.5em] text-center"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={verifyOtpMutation.isPending || otp.trim().length < 4}
                >
                  {verifyOtpMutation.isPending ? "Verifying…" : "Verify Email"}
                </Button>
              </form>
            </div>

            {/* Resend / change email */}
            <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm dark:bg-card">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { setPhase("email-entry"); setOtp(""); setOtpEmail("") }}
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={resendCountdown > 0 || requestOtpMutation.isPending}
                className="flex items-center gap-1.5 text-primary disabled:opacity-50"
                onClick={() => requestOtpMutation.mutate(otpEmail)}
              >
                <IconRefresh className="size-3.5" />
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        {/* ── Already verified chip ── */}
        {(phase === "email-entry" || phase === "email-otp") && getExamSession(code).examAccessToken && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
            <IconShieldCheck className="size-4 shrink-0" />
            Access code verified. Now verify your email to continue.
          </div>
        )}
      </ExamPageShell>
    </PublicExamLayout>
  )
}
