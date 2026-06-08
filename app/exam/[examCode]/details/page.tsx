import { ExamDetails } from "@/components/public-exam/exam-details"

export default async function ExamDetailsPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  return <ExamDetails examCode={examCode} />
}
