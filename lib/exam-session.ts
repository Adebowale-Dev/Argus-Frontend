"use client"

// Stores per-exam candidate state in sessionStorage so it survives
// page navigations but is cleared when the tab closes.
// Nothing here is a login — candidates never get a persistent account token.

const PREFIX = "argus_exam:"

type ExamSessionData = {
  examAccessToken?: string
  accessMode?: string
  verifiedEmail?: string
  emailVerificationToken?: string
  candidateInfo?: {
    fullName?: string
    email?: string
    phone?: string
    identifier?: string
    metadata?: Record<string, string>
  }
  attemptId?: string
  attemptToken?: string
  autoSubmitted?: boolean
}

export function getExamSession(examCode: string): ExamSessionData {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${examCode.toUpperCase()}`)
    return raw ? (JSON.parse(raw) as ExamSessionData) : {}
  } catch {
    return {}
  }
}

export function setExamSession(examCode: string, data: Partial<ExamSessionData>) {
  if (typeof window === "undefined") return
  const current = getExamSession(examCode)
  sessionStorage.setItem(
    `${PREFIX}${examCode.toUpperCase()}`,
    JSON.stringify({ ...current, ...data }),
  )
}

export function clearExamSession(examCode: string) {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(`${PREFIX}${examCode.toUpperCase()}`)
}

export function getExamAttemptToken(examCode: string): string | null {
  return getExamSession(examCode).attemptToken ?? null
}

export function setExamAttemptToken(examCode: string, attemptId: string, token: string) {
  setExamSession(examCode, { attemptId, attemptToken: token })
  // Also write to the global attempt token map for attemptRequest compatibility
  if (typeof window !== "undefined") {
    localStorage.setItem(`argus_attempt_token:${attemptId}`, token)
  }
}
