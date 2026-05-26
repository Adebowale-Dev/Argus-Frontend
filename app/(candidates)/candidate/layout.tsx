import { WorkspaceLayout } from "@/components/workspace/workspace-layout"

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayout
      allowedRoles={["CANDIDATE"]}
      title="Candidate Workspace"
      description="Assigned exams and secure attempt readiness"
    >
      {children}
    </WorkspaceLayout>
  )
}
