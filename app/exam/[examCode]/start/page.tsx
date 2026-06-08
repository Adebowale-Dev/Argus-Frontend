import { ExamStart } from "@/components/public-exam/exam-start"

export default async function ExamStartPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  return <ExamStart examCode={examCode} />
}
