"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequest, ApiRequestError, currentUser } from "@/lib/api/client"
import { homeForRole } from "@/lib/auth/routing"
import { cn } from "@/lib/utils"

export function ChangePasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => apiRequest("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: async () => {
      const user = await currentUser()
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
      toast.success("Password changed. Your workspace is ready.")
      router.replace(homeForRole(user.role))
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get("currentPassword"))
    const newPassword = String(form.get("newPassword"))
    if (newPassword !== String(form.get("confirmPassword"))) {
      toast.error("New passwords do not match.")
      return
    }
    mutation.mutate({ currentPassword, newPassword })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Change your password</CardTitle>
          <CardDescription>Choose a new password before opening your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input id="new-password" name="newPassword" type="password" minLength={8} autoComplete="new-password" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                <Input id="confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Updating password..." : "Change password"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Temporary passwords must be replaced for secure access.
      </FieldDescription>
    </div>
  )
}
