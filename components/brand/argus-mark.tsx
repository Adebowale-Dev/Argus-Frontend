import Image from "next/image"

import { cn } from "@/lib/utils"

export function ArgusMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
        <Image src="/logo.svg" alt="ARGUS" width={40} height={40} priority={false} />
      {!compact && (
        <span>
          <span className="block text-lg font-bold tracking-tight">ARGUS</span>
          <span className="block text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Exam Security</span>
        </span>
      )}
    </div>
  )
}
