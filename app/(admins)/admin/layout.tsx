import { WorkspaceLayout } from "@/components/workspace/workspace-layout"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayout
      allowedRoles={["SUPER_ADMIN", "SUB_ADMIN"]}
      title="Administration"
      description="Users, reports and examination integrity oversight"
    >
      {children}
    </WorkspaceLayout>
  )
}
