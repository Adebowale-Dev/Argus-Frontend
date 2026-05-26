"use client"

import type { ApiEnvelope, AuthUser, LoginInput, RegisterExaminerInput, Session } from "@/lib/api/types"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1"
export const serverUrl = apiUrl.replace(/\/api\/v1\/?$/, "")
const sessionKey = "argus_session"
const attemptTokenPrefix = "argus_attempt_token:"

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Array<Record<string, unknown>> = [],
  ) {
    super(message)
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(sessionKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    window.localStorage.removeItem(sessionKey)
    return null
  }
}

export function setSession(session: Session) {
  window.localStorage.setItem(sessionKey, JSON.stringify(session))
}

export function clearSession() {
  window.localStorage.removeItem(sessionKey)
}
export function setAttemptToken(attemptId: string, token: string) {
  window.localStorage.setItem(`${attemptTokenPrefix}${attemptId}`, token)
}
export function getAttemptToken(attemptId: string) {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(`${attemptTokenPrefix}${attemptId}`)
}

async function readResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok) {
    throw new ApiRequestError(payload?.message ?? "Request failed. Please try again.", response.status, payload?.errors ?? [])
  }
  return payload as ApiEnvelope<T>
}

async function refreshSession() {
  const response = await fetch(`${apiUrl}/auth/refresh-token`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
  const envelope = await readResponse<Session>(response)
  setSession(envelope.data)
  return envelope.data.accessToken
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { authenticated?: boolean; retry?: boolean } = {},
) {
  const authenticated = options.authenticated ?? true
  const token = authenticated ? getSession()?.accessToken : undefined
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (response.status === 401 && authenticated && options.retry !== false) {
    try {
      const refreshedToken = await refreshSession()
      return apiRequest<T>(path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${refreshedToken}` },
      }, { authenticated: true, retry: false })
    } catch {
      clearSession()
      throw new ApiRequestError("Your session has expired. Please sign in again.", 401)
    }
  }
  return readResponse<T>(response)
}

export async function attemptRequest<T>(attemptId: string, path: string, init: RequestInit = {}) {
  const token = getAttemptToken(attemptId)
  if (!token) return apiRequest<T>(path, init)
  return apiRequest<T>(path, {
    ...init,
    headers: {
      ...(token ? { "X-Attempt-Token": token } : {}),
      ...init.headers,
    },
  }, { authenticated: false })
}

export async function login(input: LoginInput) {
  const response = await apiRequest<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  }, { authenticated: false })
  setSession(response.data)
  return response.data
}

export async function registerExaminer(input: RegisterExaminerInput) {
  const response = await apiRequest<AuthUser>("/auth/register-examiner", {
    method: "POST",
    body: JSON.stringify(input),
  }, { authenticated: false })
  return response.data
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" })
  } finally {
    clearSession()
  }
}

export async function currentUser() {
  const response = await apiRequest<AuthUser>("/auth/me")
  const session = getSession()
  if (session) setSession({ ...session, user: response.data })
  return response.data
}

export async function downloadApiFile(path: string, filename: string) {
  const token = getSession()?.accessToken
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new ApiRequestError(payload?.message ?? "Download failed.", response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
