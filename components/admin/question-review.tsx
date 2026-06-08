"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiRequest } from "@/lib/api/client"
import type { Question, QuestionBank } from "@/lib/api/types"

export function QuestionReview() {
  const [bankId, setBankId] = useState("")
  const banks = useQuery({
    queryKey: ["admin", "question-banks"],
    queryFn: () => apiRequest<QuestionBank[]>("/question-banks?limit=100").then((r) => r.data),
  })
  const params = new URLSearchParams({ limit: "100" })
  if (bankId) params.set("questionBank", bankId)
  const questions = useQuery({
    queryKey: ["admin", "questions", bankId],
    queryFn: () => apiRequest<Question[]>(`/questions?${params}`).then((r) => r.data),
  })

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading
        title="Question Oversight"
        description="Review the question inventory across examiner-owned banks without exposing candidate-facing answer payloads."
      />
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform questions</CardTitle>
            <CardDescription>Filter by examiner question bank.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <Field>
                <FieldLabel>Question bank</FieldLabel>
                <select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All banks</option>
                  {banks.data?.map((bank) => (
                    <option key={entityId(bank)} value={entityId(bank)}>{bank.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            {!questions.data?.length ? (
              <EmptyState message={questions.isPending ? "Loading questions…" : "No questions match these filters."} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.data.map((question) => (
                    <TableRow key={entityId(question)}>
                      <TableCell>
                        <div className="max-w-xl font-medium">{question.questionText}</div>
                        {question.topic && (
                          <div className="mt-1">
                            <Badge variant="outline">{question.topic}</Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{question.questionType.replaceAll("_", " ")}</TableCell>
                      <TableCell>{question.marks}</TableCell>
                      <TableCell><StatusBadge status={question.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
