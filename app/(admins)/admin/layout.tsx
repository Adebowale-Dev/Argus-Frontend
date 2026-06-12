import { WorkspaceLayout } from "@/components/workspace/workspace-layout"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayout
      allowedRoles={["SUPER_ADMIN", "SUB_ADMIN"]}
      title="Administration"
      description="Monitor platform activity, moderate examinations, and keep ARGUS operating securely."
    >
      {children}
    </WorkspaceLayout>
  )
}
