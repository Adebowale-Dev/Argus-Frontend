"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { KeyRoundIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequest, ApiRequestError, currentUser } from "@/lib/api/client"
import type { AuthUser, CreateUserInput } from "@/lib/api/types"

const permissions = [
  "MANAGE_USERS",
  "MANAGE_EXAMINERS",
  "MANAGE_CANDIDATES",
  "VIEW_DASHBOARD",
  "VIEW_USERS",
  "VIEW_ALL_EXAMS",
  "VIEW_ALL_ATTEMPTS",
  "VIEW_ALL_REPORTS",
  "VIEW_ANTI_CHEAT_REPORTS",
  "VIEW_REPORTS",
  "VIEW_AUDIT_LOGS",
  "MANAGE_PLATFORM_SETTINGS",
  "DISABLE_EXAMS",
  "BLOCK_USERS",
  "RESET_USER_PASSWORDS",
] as const

type ManagedRole = CreateUserInput["role"]

function temporaryPassword() {
  const random = crypto.getRandomValues(new Uint32Array(2)).join("")
  return `Argus!${random.slice(0, 10)}`
}

export function CreateUserForm({ workspace = "admin" }: { workspace?: "admin" | "examiner" }) {
  const { data: actor } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const [role, setRole] = useState<ManagedRole>("CANDIDATE")
  const [password, setPassword] = useState(() => temporaryPassword())
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const canCreateSubAdmin = actor?.role === "SUPER_ADMIN" && workspace === "admin"
  const canCreateExaminer = workspace === "admin"

  const mutation = useMutation({
    mutationFn: (input: CreateUserInput) => apiRequest<AuthUser>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    onSuccess: (response) => {
      toast.success(`${response.data.fullName} has been enrolled.`, {
        description: "A temporary-password notification will be handled by ARGUS email settings.",
      })
      setPassword(temporaryPassword())
      setSelectedPermissions([])
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      fullName: String(form.get("fullName")),
      email: String(form.get("email")),
      username: String(form.get("username")) || undefined,
      password,
      role,
      permissions: role === "SUB_ADMIN" ? selectedPermissions : [],
    })
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_.48fr] lg:px-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><UserPlusIcon className="size-5 text-primary" /> Provision an account</CardTitle>
          <CardDescription>
            {workspace === "examiner"
              ? "Create and manage candidate accounts for your own exams. New candidates must change their temporary password."
              : "Create controlled access for sub-admins, examiners, or candidates. New users must change their temporary password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input id="fullName" name="fullName" required placeholder="Amina Bello" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input id="username" name="username" placeholder="amina.bello" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
                  <Input id="invite-email" name="email" type="email" required placeholder="name@organization.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Account role</FieldLabel>
                <select
                  id="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as ManagedRole)}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="CANDIDATE">Candidate</option>
                  {canCreateExaminer && <option value="EXAMINER">Examiner</option>}
                  {canCreateSubAdmin && <option value="SUB_ADMIN">Sub-admin</option>}
                </select>
                {workspace === "examiner"
                  ? <FieldDescription>Examiner workspaces can only provision candidate accounts.</FieldDescription>
                  : !canCreateSubAdmin ? <FieldDescription>Only a super admin can provision sub-admin accounts.</FieldDescription> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="temporary-password">Temporary password</FieldLabel>
                <div className="flex gap-2">
                  <Input id="temporary-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                  <Button variant="outline" type="button" onClick={() => setPassword(temporaryPassword())}>
                    <KeyRoundIcon /> Generate
                  </Button>
                </div>
              </Field>
              {role === "SUB_ADMIN" && canCreateSubAdmin && (
                <Field>
                  <FieldLabel>Sub-admin permissions</FieldLabel>
                  <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
                    {permissions.map((permission) => (
                      <label className="flex items-center gap-2 text-sm" key={permission}>
                        <Checkbox
                          checked={selectedPermissions.includes(permission)}
                          onCheckedChange={(checked) => setSelectedPermissions((current) => checked
                            ? [...current, permission]
                            : current.filter((value) => value !== permission))}
                        />
                        {permission.replaceAll("_", " ").toLowerCase()}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              <Button type="submit" size="lg" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating account..." : "Create secure account"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit border-primary/10 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Provisioning policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Sub-admins cannot create other administrators or grant themselves permissions.</p>
          <p>Examiners own their question banks and publish exams through public access or verified email invite flows.</p>
          <p>{workspace === "examiner" ? "Candidate accounts you create are scoped to your onboarding and exam operations." : "Admins retain full system-wide governance and reporting access."}</p>
        </CardContent>
      </Card>
    </div>
  )
}
