"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Icon } from "@tabler/icons-react"
import { IconCirclePlusFilled } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function NavMain({
  items,
  createHref,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
  createHref?: string
}) {
  const pathname = usePathname()
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {createHref && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Create account"
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <Link href={createHref}>
                  <IconCirclePlusFilled />
                  <span>New account</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                isActive={isActive(item.url)}
                className={cn(
                  "relative hover:bg-primary/10 hover:text-primary hover:ring-1 hover:ring-primary/20",
                  isActive(item.url) && "bg-primary/15 text-primary font-semibold ring-1 ring-primary/25 before:absolute before:left-0 before:top-1.5 before:h-5 before:w-1 before:rounded-r-full before:bg-primary"
                )}
              >
                <Link href={item.url} aria-current={isActive(item.url) ? "page" : undefined}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
