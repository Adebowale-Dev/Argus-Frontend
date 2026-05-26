"use client"

import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequest, ApiRequestError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const mutation = useMutation({
    mutationFn: (email: string) => apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }, { authenticated: false }),
    onSuccess: () => toast.success("If the account exists, reset instructions have been sent."),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>Enter your email to receive reset instructions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate(String(new FormData(event.currentTarget).get("email")))
          }}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                <Input id="reset-email" name="email" type="email" placeholder="m@example.com" autoComplete="email" required />
              </Field>
              <Field>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Sending..." : "Send reset instructions"}
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/login" className="underline underline-offset-4">Return to login</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        If an account exists, a secure reset email will be sent.
      </FieldDescription>
    </div>
  )
}
