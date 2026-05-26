import { ShieldCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function ArgusMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ShieldCheckIcon className="size-5" />
      </span>
      {!compact && (
        <span>
          <span className="block text-lg font-bold tracking-tight">ARGUS</span>
          <span className="block text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Exam Security</span>
        </span>
      )}
    </div>
  )
}
