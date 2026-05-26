"use client"

import Link from "next/link"
import {
  IconBook,
  IconChartBar,
  IconDashboard,
  IconFileSettings,
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
    { title: "Accounts", url: "/admin/users", icon: IconUsers },
    { title: "Question oversight", url: "/admin/questions", icon: IconBook },
    { title: "Examinations", url: "/admin/exams", icon: IconShieldCheck },
    { title: "Reports and integrity", url: "/admin/reports", icon: IconReportAnalytics },
    { title: "Governance", url: "/admin/governance", icon: IconFileSettings },
  ],
  EXAMINER: [
    { title: "Dashboard", url: "/examiner/dashboard", icon: IconDashboard },
    { title: "Question bank", url: "/examiner/questions", icon: IconBook },
    { title: "Examinations", url: "/examiner/exams", icon: IconShieldCheck },
  ],
  CANDIDATE: [
    { title: "Dashboard", url: "/candidate/dashboard", icon: IconDashboard },
    { title: "My exams", url: "/candidate/exams", icon: IconBook },
  ],
} satisfies Partial<Record<Role, { title: string; url: string; icon: typeof IconDashboard }[]>>

const documents = {
  SUPER_ADMIN: [
    { name: "Exam Reports", url: "/admin/reports", icon: IconReportAnalytics },
    { name: "User Provisioning", url: "/admin/users/new", icon: IconFileDescription },
  ],
  SUB_ADMIN: [
    { name: "Exam Reports", url: "/admin/reports", icon: IconReportAnalytics },
  ],
  EXAMINER: [
    { name: "Assessment Reports", url: "/examiner/exams", icon: IconReportAnalytics },
  ],
  CANDIDATE: [
    { name: "Exam Schedule", url: "/candidate/exams", icon: IconFileDescription },
  ],
} satisfies Record<Role, { name: string; url: string; icon: typeof IconDashboard }[]>

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: AuthUser }) {
  const admin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN"
  const subAdminNavigation = [
    { title: "Dashboard", url: "/admin/dashboard", icon: IconDashboard },
    { title: "Examinations", url: "/admin/exams", icon: IconShieldCheck },
    ...(user.permissions.some((permission) => ["MANAGE_USERS", "MANAGE_EXAMINERS", "MANAGE_CANDIDATES"].includes(permission)) ? [{ title: "Accounts", url: "/admin/users", icon: IconUsers }] : []),
    ...(user.permissions.includes("VIEW_REPORTS") ? [{ title: "Question oversight", url: "/admin/questions", icon: IconBook }] : []),
    ...(user.permissions.some((permission) => ["VIEW_REPORTS", "VIEW_ALL_REPORTS", "VIEW_ANTI_CHEAT_REPORTS"].includes(permission)) ? [{ title: "Reports and integrity", url: "/admin/reports", icon: IconReportAnalytics }] : []),
    ...(user.permissions.some((permission) => ["VIEW_AUDIT_LOGS", "MANAGE_SETTINGS", "MANAGE_PLATFORM_SETTINGS"].includes(permission)) ? [{ title: "Governance", url: "/admin/governance", icon: IconChartBar }] : []),
  ]
  const navigation = user.role === "SUB_ADMIN" ? subAdminNavigation : (mainNavigation[user.role] ?? [])
  const userDocuments = user.role === "SUB_ADMIN" && !user.permissions.includes("VIEW_REPORTS") ? [] : documents[user.role]

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
        <NavMain items={navigation} createHref={admin && (user.role === "SUPER_ADMIN" || user.permissions.some((permission) => ["MANAGE_EXAMINERS", "MANAGE_CANDIDATES"].includes(permission))) ? "/admin/users/new" : undefined} />
        <NavDocuments items={userDocuments} />
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
