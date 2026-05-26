import Link from "next/link"
import { ShieldCheckIcon } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/login" className="flex items-center gap-2 self-center font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheckIcon className="size-4" />
          </span>
          ARGUS
        </Link>
        {children}
      </div>
    </main>
  )
}
