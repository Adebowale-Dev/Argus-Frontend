"use client"

import type { ApiEnvelope, AuthUser, LoginInput, Session } from "@/lib/api/types"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1"
const sessionKey = "argus_session"

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
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

async function readResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok) {
    throw new ApiRequestError(payload?.message ?? "Request failed. Please try again.", response.status)
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

export async function login(input: LoginInput) {
  const response = await apiRequest<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  }, { authenticated: false })
  setSession(response.data)
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
