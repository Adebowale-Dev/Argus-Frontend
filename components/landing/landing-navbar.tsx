"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import { currentUser, getSession, logout, subscribeToSession } from "@/lib/api/client"
import { ArgusMark } from "@/components/brand/argus-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { homeForRole, roleLabel } from "@/lib/auth/routing"

export function LandingNavbar() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasSession = useSyncExternalStore(subscribeToSession, () => Boolean(getSession()), () => false)
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    enabled: hasSession,
    retry: false,
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["auth"] })
      toast.success("You have been signed out securely.")
      router.replace("/")
      router.refresh()
    },
  })

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <ArgusMark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">How it works</Link>
          <Link href="#platform" className="transition-colors hover:text-foreground">Platform</Link>
          <Link href="#roles" className="transition-colors hover:text-foreground">Who it serves</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {hasSession && user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
              </div>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href={homeForRole(user.role)}>Go to dashboard</Link>
              </Button>
              <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                {logoutMutation.isPending ? "Logging out..." : "Log out"}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/login">Examiner sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
