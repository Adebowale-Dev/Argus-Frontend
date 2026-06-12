"use client"

import { usePathname } from "next/navigation"
import { IconCommand, IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader({ title, description }: { title: string; description?: string }) {
  const pathname = usePathname()
  const section = pathname.split("/").filter(Boolean).slice(1).join(" / ") || "dashboard"
  return <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b bg-background/90 backdrop-blur-xl transition-[width,height]">
    <div className="flex w-full items-center gap-2 px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold">{title}</h1><span className="hidden text-xs text-muted-foreground md:inline">/ {section}</span></div>{description && <p className="hidden truncate text-[11px] text-muted-foreground lg:block">{description}</p>}</div>
      <div className="ml-auto flex items-center gap-1.5"><Button variant="outline" size="sm" className="hidden min-w-48 justify-between text-muted-foreground lg:flex"><span className="flex items-center gap-2"><IconSearch /> Search workspace</span><span className="flex items-center gap-1 text-[10px]"><IconCommand className="size-3" />K</span></Button><ThemeToggle /></div>
    </div>
  </header>
}
