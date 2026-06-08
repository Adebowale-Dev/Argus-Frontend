import { QuestionBankWorkspace } from "@/components/examiner/question-bank"

export default async function QuestionBankWorkspacePage({
  params,
}: {
  params: Promise<{ bankId: string }>
}) {
  const { bankId } = await params
  return <QuestionBankWorkspace bankId={bankId} />
}
