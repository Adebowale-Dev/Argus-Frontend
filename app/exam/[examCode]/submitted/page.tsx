import { Suspense } from "react"
import { ExamSubmitted } from "@/components/public-exam/exam-submitted"

export default async function ExamSubmittedPage({
  params,
}: {
  params: Promise<{ examCode: string }>
}) {
  const { examCode } = await params
  return (
    <Suspense>
      <ExamSubmitted examCode={examCode} />
    </Suspense>
  )
}
