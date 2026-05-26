"use client"

import Link from "next/link"
import { useState } from "react"
import { IconEdit, IconLock, IconPlus, IconSearch, IconTrash, IconUserCheck, IconUserOff } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { EmptyState, PageHeading, StatusBadge, entityId } from "@/components/workspace/page-elements"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiRequest, ApiRequestError, currentUser } from "@/lib/api/client"
import type { Paginated, Role, User } from "@/lib/api/types"
import { roleLabel } from "@/lib/auth/routing"

const permissions = [
  "MANAGE_USERS",
  "MANAGE_EXAMINERS",
  "MANAGE_CANDIDATES",
  "MANAGE_DEPARTMENTS",
  "MANAGE_COURSES",
  "VIEW_REPORTS",
  "VIEW_AUDIT_LOGS",
  "MANAGE_SETTINGS",
  "BLOCK_USERS",
  "RESET_USER_PASSWORDS",
] as const

type ConfirmAction = "block" | "unblock" | "reset" | "delete"

function generatedPassword() {
  return `Argus!${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10)}`
}

export function UsersManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<Role>("CANDIDATE")
  const [editPermissions, setEditPermissions] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState<{ user: User; type: ConfirmAction } | null>(null)
  const { data: actor } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const users = useQuery({
    queryKey: ["users", search],
    queryFn: () => apiRequest<User[]>(`/users?limit=50&search=${encodeURIComponent(search)}`).then((result) => result as Paginated<User>),
  })

  const action = useMutation({
    mutationFn: async ({ user, type }: { user: User; type: ConfirmAction }) => {
      const id = entityId(user)
      if (type === "block") return apiRequest(`/users/${id}/block`, { method: "PATCH", body: JSON.stringify({ reason: "Blocked through the ARGUS administration workspace." }) })
      if (type === "unblock") return apiRequest(`/users/${id}/unblock`, { method: "PATCH" })
      if (type === "delete") return apiRequest(`/users/${id}`, { method: "DELETE" })
      const temporaryPassword = generatedPassword()
      await apiRequest(`/users/${id}/password-reset`, { method: "PATCH", body: JSON.stringify({ temporaryPassword }) })
      return { message: `Temporary password issued: ${temporaryPassword}` }
    },
    onSuccess: (response, values) => {
      toast.success(response.message ?? `${values.type} completed successfully.`)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setConfirmation(null)
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  const saveUser = useMutation({
    mutationFn: async ({ user, body, role, assignedPermissions }: { user: User; body: { fullName: string; username?: string }; role: Role; assignedPermissions: string[] }) => {
      const id = entityId(user)
      await apiRequest(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...body, ...(user.role === "SUB_ADMIN" && role === user.role ? { permissions: assignedPermissions } : {}) }),
      })
      if (actor?.role === "SUPER_ADMIN" && (role !== user.role || role === "SUB_ADMIN")) {
        await apiRequest(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role, permissions: role === "SUB_ADMIN" ? assignedPermissions : [] }) })
      }
    },
    onSuccess: () => {
      toast.success("User account updated.")
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  function beginEdit(user: User) {
    setEditing(user)
    setEditRole(user.role)
    setEditPermissions(user.permissions ?? [])
  }

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    saveUser.mutate({
      user: editing,
      role: editRole,
      assignedPermissions: editPermissions,
      body: { fullName: String(form.get("fullName")), username: String(form.get("username")) || undefined },
    })
  }

  const selfId = actor?.id

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading
        title="User Management"
        description="Provision accounts, manage roles and permissions, and enforce access status."
        action={<Button asChild><Link href="/admin/users/new"><IconPlus /> New account</Link></Button>}
      />
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search users by name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            {!users.data?.data.length ? <EmptyState message={users.isPending ? "Loading users..." : "No users match this search."} /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.data.map((user) => {
                    const isSelf = entityId(user) === selfId
                    return (
                      <TableRow key={entityId(user)}>
                        <TableCell>
                          <div className="font-medium">{user.fullName}{isSelf ? " (you)" : ""}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>{roleLabel(user.role)}</TableCell>
                        <TableCell><StatusBadge status={user.status} /></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="ghost" aria-label="Edit user" onClick={() => beginEdit(user)}><IconEdit /></Button>
                            {user.status === "BLOCKED" ? (
                              <Button size="icon-sm" variant="ghost" disabled={isSelf} aria-label="Unblock user" onClick={() => setConfirmation({ user, type: "unblock" })}><IconUserCheck /></Button>
                            ) : (
                              <Button size="icon-sm" variant="ghost" disabled={isSelf} aria-label="Block user" onClick={() => setConfirmation({ user, type: "block" })}><IconUserOff /></Button>
                            )}
                            <Button size="icon-sm" variant="ghost" disabled={isSelf} aria-label="Reset password" onClick={() => setConfirmation({ user, type: "reset" })}><IconLock /></Button>
                            <Button size="icon-sm" variant="ghost" disabled={isSelf} aria-label="Delete user" onClick={() => setConfirmation({ user, type: "delete" })}><IconTrash /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>Update identity, role, and delegated permissions for this account.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={submitEdit}>
              <FieldGroup>
                <Field><FieldLabel>Full name</FieldLabel><Input name="fullName" defaultValue={editing.fullName} required /></Field>
                <Field><FieldLabel>Username</FieldLabel><Input name="username" defaultValue={editing.username ?? ""} /></Field>
                {actor?.role === "SUPER_ADMIN" && entityId(editing) !== selfId && (
                  <Field>
                    <FieldLabel>Role</FieldLabel>
                    <select value={editRole} onChange={(event) => setEditRole(event.target.value as Role)} className="h-9 rounded-md border bg-background px-3 text-sm">
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="SUB_ADMIN">Sub Admin</option>
                      <option value="EXAMINER">Examiner</option>
                      <option value="CANDIDATE">Candidate</option>
                    </select>
                  </Field>
                )}
                {editRole === "SUB_ADMIN" && actor?.role === "SUPER_ADMIN" && (
                  <Field>
                    <FieldLabel>Delegated permissions</FieldLabel>
                    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                      {permissions.map((permission) => (
                        <label className="flex items-center gap-2 text-sm" key={permission}>
                          <Checkbox
                            checked={editPermissions.includes(permission)}
                            onCheckedChange={(checked) => setEditPermissions((current) => checked ? [...current, permission] : current.filter((item) => item !== permission))}
                          />
                          {permission.replaceAll("_", " ").toLowerCase()}
                        </label>
                      ))}
                    </div>
                  </Field>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button disabled={saveUser.isPending}>Save changes</Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm administrative action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.type === "delete" && `This will deactivate ${confirmation.user.fullName}'s account and revoke their session.`}
              {confirmation?.type === "block" && `This will block ${confirmation.user.fullName} from signing in.`}
              {confirmation?.type === "unblock" && `This will restore access for ${confirmation.user.fullName}.`}
              {confirmation?.type === "reset" && `This will invalidate ${confirmation.user.fullName}'s existing password and generate a temporary password.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmation?.type === "delete" || confirmation?.type === "block" ? "destructive" : "default"}
              disabled={action.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (confirmation) action.mutate(confirmation)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
