"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { IconDotsVertical, IconHelp, IconLogout } from "@tabler/icons-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { logout } from "@/lib/api/client"
import { roleLabel } from "@/lib/auth/routing"
import type { Role } from "@/lib/api/types"

export function NavUser({ user }: { user: { name: string; email: string; avatar: string; role: Role } }) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const queryClient = useQueryClient()
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["auth"] })
      toast.success("You have been signed out securely.")
      router.replace("/login")
    },
    onError: () => {
      queryClient.removeQueries({ queryKey: ["auth"] })
      router.replace("/login")
    },
  })
  const initials = user.name.split(" ").map((value) => value[0]).slice(0, 2).join("").toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg grayscale"><AvatarImage src={user.avatar} alt={user.name} /><AvatarFallback className="rounded-lg">{initials}</AvatarFallback></Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-xl p-1.5" side={isMobile ? "bottom" : "right"} align="end" sideOffset={8}>
            <DropdownMenuItem><IconHelp />Help and support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}><IconLogout />{logoutMutation.isPending ? "Signing out..." : "Log out"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
