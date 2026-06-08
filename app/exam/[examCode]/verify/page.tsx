import { ExamVerify } from "@/components/public-exam/exam-verify"

export default async function ExamVerifyPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  return <ExamVerify examCode={examCode} />
}
