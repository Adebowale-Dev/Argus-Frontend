"use client"

import Link from "next/link"
import {
  IconBook,
  IconChartBar,
  IconDashboard,
  IconFileDescription,
  IconHelp,
  IconInnerShadowTop,
  IconReportAnalytics,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { homeForRole } from "@/lib/auth/routing"
import type { AuthUser, Role } from "@/lib/api/types"

const mainNavigation = {
  SUPER_ADMIN: [
    { title: "Dashboard", url: "/admin/dashboard", icon: IconDashboard },
    { title: "Accounts", url: "/admin/users/new", icon: IconUsers },
    { title: "Reports", url: "/admin/dashboard", icon: IconChartBar },
    { title: "Anti-cheat", url: "/admin/dashboard", icon: IconShieldCheck },
  ],
  SUB_ADMIN: [
    { title: "Dashboard", url: "/admin/dashboard", icon: IconDashboard },
    { title: "Accounts", url: "/admin/users/new", icon: IconUsers },
    { title: "Reports", url: "/admin/dashboard", icon: IconChartBar },
  ],
  EXAMINER: [
    { title: "Dashboard", url: "/examiner/dashboard", icon: IconDashboard },
    { title: "Question bank", url: "/examiner/dashboard", icon: IconBook },
    { title: "Monitoring", url: "/examiner/dashboard", icon: IconShieldCheck },
  ],
  CANDIDATE: [
    { title: "My exams", url: "/candidate/dashboard", icon: IconDashboard },
    { title: "Instructions", url: "/candidate/dashboard", icon: IconBook },
  ],
} satisfies Record<Role, { title: string; url: string; icon: typeof IconDashboard }[]>

const documents = {
  SUPER_ADMIN: [
    { name: "Exam Reports", url: "/admin/dashboard", icon: IconReportAnalytics },
    { name: "User Provisioning", url: "/admin/users/new", icon: IconFileDescription },
  ],
  SUB_ADMIN: [
    { name: "Exam Reports", url: "/admin/dashboard", icon: IconReportAnalytics },
  ],
  EXAMINER: [
    { name: "Assessment Reports", url: "/examiner/dashboard", icon: IconReportAnalytics },
  ],
  CANDIDATE: [
    { name: "Exam Schedule", url: "/candidate/dashboard", icon: IconFileDescription },
  ],
} satisfies Record<Role, { name: string; url: string; icon: typeof IconDashboard }[]>

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: AuthUser }) {
  const admin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href={homeForRole(user.role)}>
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">ARGUS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavigation[user.role]} createHref={admin ? "/admin/users/new" : undefined} />
        <NavDocuments items={documents[user.role]} />
        <NavSecondary
          items={[
            { title: "Get help", url: homeForRole(user.role), icon: IconHelp },
          ]}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: user.fullName, email: user.email, avatar: "" }} />
      </SidebarFooter>
    </Sidebar>
  )
}
