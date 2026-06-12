"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import { currentUser, getSession, subscribeToSession } from "@/lib/api/client"
import { homeForRole } from "@/lib/auth/routing"

export function PublicAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)
  const hasSession = useSyncExternalStore(subscribeToSession, () => Boolean(getSession()), () => false)
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    enabled: hasSession,
    retry: false,
  })

  useEffect(() => {
    if (!hasSession || !user || redirected.current) return
    if (user.mustChangePassword && pathname !== "/change-password") {
      redirected.current = true
      router.replace("/change-password")
      return
    }
    if (!user.mustChangePassword && pathname !== "/change-password") {
      redirected.current = true
      router.replace(homeForRole(user.role))
    }
  }, [hasSession, pathname, router, user])

  if (hasSession && isLoading && pathname !== "/change-password") {
    return <div className="w-full rounded-2xl border bg-card/80 p-6 text-center text-sm text-muted-foreground shadow-sm">Checking your session…</div>
  }

  if (hasSession && user && pathname !== "/change-password") return null
  return <>{children}</>
}
