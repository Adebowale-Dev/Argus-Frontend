import { PublicExamEntry } from "@/components/candidate/public-exam-entry"

export default async function PublicExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PublicExamEntry slug={slug} />
}
