"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { clearSession, currentUser, getSession, subscribeToSession } from "@/lib/api/client"
import { homeForRole } from "@/lib/auth/routing"
import type { Role } from "@/lib/api/types"

export function WorkspaceLayout({
  children,
  allowedRoles,
  title,
  description,
}: {
  children: React.ReactNode
  allowedRoles: Role[]
  title: string
  description: string
}) {
  const router = useRouter()
  const notified = useRef(false)
  const hasSession = useSyncExternalStore(subscribeToSession, () => Boolean(getSession()), () => false)
  const { data: user, isPending, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    retry: false,
    enabled: hasSession,
  })

  useEffect(() => {
    if (!hasSession) {
      clearSession()
      if (!notified.current) {
        notified.current = true
        toast.error("Please sign in to continue.")
      }
      router.replace("/login")
      return
    }

    if (error) {
      clearSession()
      if (!notified.current) {
        notified.current = true
        toast.error("Please sign in to continue.")
      }
      router.replace("/login")
    } else if (user?.mustChangePassword && !notified.current) {
      notified.current = true
      toast.warning("Change your temporary password before entering your workspace.")
      router.replace("/change-password")
    } else if (user && !allowedRoles.includes(user.role)) {
      router.replace(homeForRole(user.role))
    }
  }, [allowedRoles, error, hasSession, router, user])

  if (!hasSession || isPending || !user || user.mustChangePassword || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-svh bg-muted/30">
        <div className="hidden w-64 border-r bg-card p-5 md:block"><Skeleton className="h-10 w-36" /></div>
        <div className="flex-1 space-y-5 p-8">
          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} description={description} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
