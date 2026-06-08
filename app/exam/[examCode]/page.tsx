import { PublicExamEntry } from "@/components/candidate/public-exam-entry"
import { ExamLanding } from "@/components/public-exam/exam-landing"

export default async function ExamLandingPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  const normalized = examCode.trim()

  if (/^AR\d{4}$/i.test(normalized)) {
    return <ExamLanding examCode={normalized} />
  }

  return <PublicExamEntry slug={normalized} />
}
