"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { login, ApiRequestError } from "@/lib/api/client"
import { homeForRole, roleLabel } from "@/lib/auth/routing"
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      toast.success(`Welcome back, ${session.user.fullName}.`, {
        description: `${roleLabel(session.user.role)} workspace unlocked.`,
      })
      if (session.user.mustChangePassword) {
        toast.warning("Change your temporary password after signing in.")
        router.replace("/change-password")
        return
      }
      router.replace(homeForRole(session.user.role))
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    loginMutation.mutate({
      identifier: String(data.get("identifier")),
      password: String(data.get("password")),
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your ARGUS workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
                <Input id="identifier" name="identifier" placeholder="admin@gmail.com or adaeze.okafor" autoComplete="username" required />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link href="/forgot-password" className="ml-auto text-sm underline-offset-4 hover:underline">
                    Forgot your password?
                  </Link>
                </div>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Signing in..." : "Login"}
                </Button>
                <FieldDescription className="text-center">
                  New examiner? <Link href="/register/examiner" className="underline underline-offset-4">Create an account</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Secure access to monitored examinations and administration.
      </FieldDescription>
    </div>
  )
}
