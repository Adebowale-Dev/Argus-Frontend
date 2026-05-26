"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequest, ApiRequestError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

export function ResetPasswordForm({
  token,
  className,
  ...props
}: { token?: string } & React.ComponentProps<"div">) {
  const router = useRouter()
  const mutation = useMutation({
    mutationFn: (password: string) => apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }, { authenticated: false }),
    onSuccess: () => {
      toast.success("Your password has been reset. Sign in to continue.")
      router.replace("/login")
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      toast.error("This reset link is missing its security token.")
      return
    }
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password !== String(form.get("confirmPassword"))) {
      toast.error("New passwords do not match.")
      return
    }
    mutation.mutate(password)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <CardDescription>Finish resetting your ARGUS account password.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <FieldGroup>
              <Field>
                <FieldDescription className="text-center">
                  This reset link is incomplete or expired. Request a new email to continue.
                </FieldDescription>
              </Field>
              <Field>
                <Button asChild>
                  <Link href="/forgot-password">Request a new reset link</Link>
                </Button>
              </Field>
            </FieldGroup>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reset-new-password">New password</FieldLabel>
                  <Input id="reset-new-password" name="password" type="password" minLength={8} autoComplete="new-password" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reset-confirm-password">Confirm password</FieldLabel>
                  <Input id="reset-confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
                </Field>
                <Field>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Updating password..." : "Reset password"}
                  </Button>
                  <FieldDescription className="text-center">
                    <Link href="/login" className="underline underline-offset-4">Return to login</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Password resets are protected by time-limited secure links.
      </FieldDescription>
    </div>
  )
}
