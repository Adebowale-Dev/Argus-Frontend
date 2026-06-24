"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function NavDocuments({
  items,
}: {
  items: { name: string; url: string; icon: Icon }[]
}) {
  const pathname = usePathname()
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              asChild
              isActive={isActive(item.url)}
              className={cn(
                "relative hover:bg-primary/10 hover:text-primary hover:ring-1 hover:ring-primary/20",
                isActive(item.url) && "bg-primary/15 text-primary font-semibold ring-1 ring-primary/25 before:absolute before:left-0 before:top-1.5 before:h-5 before:w-1 before:rounded-r-full before:bg-primary"
              )}
            >
              <Link href={item.url} aria-current={isActive(item.url) ? "page" : undefined}>
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
