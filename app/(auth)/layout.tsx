import Link from "next/link"

import { ArgusMark } from "@/components/brand/argus-mark"
import { PublicAuthGuard } from "@/components/auth/public-auth-guard"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center transition-opacity hover:opacity-90">
          <ArgusMark />
        </Link>
        <PublicAuthGuard>{children}</PublicAuthGuard>
      </div>
    </main>
  )
}
