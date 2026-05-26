import { WorkspaceLayout } from "@/components/workspace/workspace-layout"

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayout
      allowedRoles={["EXAMINER"]}
      title="Examiner Workspace"
      description="Author assessments and monitor live examination integrity"
    >
      {children}
    </WorkspaceLayout>
  )
}
