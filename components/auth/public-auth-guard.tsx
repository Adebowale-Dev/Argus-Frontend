"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { currentUser, getSession } from "@/lib/api/client"
import { homeForRole } from "@/lib/auth/routing"

export function PublicAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)
  const hasSession = Boolean(getSession())
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    enabled: hasSession,
    retry: false,
  })

  useEffect(() => {
    if (!user || redirected.current) return
    if (user.mustChangePassword && pathname !== "/change-password") {
      redirected.current = true
      router.replace("/change-password")
      return
    }
    if (!user.mustChangePassword && pathname !== "/change-password") {
      redirected.current = true
      router.replace(homeForRole(user.role))
    }
  }, [pathname, router, user])

  if (hasSession && isLoading && pathname !== "/change-password") {
    return <div className="w-full rounded-2xl border bg-card/80 p-6 text-center text-sm text-muted-foreground shadow-sm">Checking your session…</div>
  }

  if (user && pathname !== "/change-password") return null
  return <>{children}</>
}
