import { ExamResult } from "@/components/public-exam/exam-result"

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  return <ExamResult examCode={examCode} />
}
