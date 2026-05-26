"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiRequestError, registerExaminer } from "@/lib/api/client"
import { cn } from "@/lib/utils"

export function RegisterExaminerForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const mutation = useMutation({
    mutationFn: registerExaminer,
    onSuccess: (user) => {
      toast.success(`${user.fullName} is ready for ARGUS.`, {
        description: "Your examiner account has been created. Sign in to start building question banks.",
      })
      router.replace("/login")
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      fullName: String(data.get("fullName")),
      email: String(data.get("email")),
      username: String(data.get("username")) || undefined,
      password: String(data.get("password")),
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create examiner account</CardTitle>
          <CardDescription>Start building secure exams, question banks, and public assessment links.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <Input id="fullName" name="fullName" required placeholder="Adaeze Okafor" />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required placeholder="examiner@organization.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input id="username" name="username" placeholder="adaeze.okafor" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" minLength={8} required />
                <FieldDescription>Use at least 8 characters for your examiner workspace password.</FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Creating account..." : "Create examiner account"}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/login" className="underline underline-offset-4">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Examiner accounts create and publish exams. Platform admin controls still apply.
      </FieldDescription>
    </div>
  )
}
