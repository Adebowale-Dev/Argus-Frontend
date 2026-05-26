"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { EmptyState, PageHeading, entityId } from "@/components/workspace/page-elements"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiRequest, ApiRequestError, currentUser } from "@/lib/api/client"

type Audit = { _id?: string; id?: string; action: string; actorRole?: string; description: string; resourceType?: string; createdAt: string }
type Setting = { _id?: string; id?: string; key: string; value: unknown; description?: string; category?: string }

function parseSettingValue(setting: Setting, value: string) {
  if (typeof setting.value === "boolean") return value === "true"
  if (typeof setting.value === "number") return Number(value)
  return value
}

export function Governance() {
  const queryClient = useQueryClient()
  const { data: actor } = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser })
  const canAudit = actor?.role === "SUPER_ADMIN" || actor?.permissions.includes("VIEW_AUDIT_LOGS")
  const canSettings = actor?.role === "SUPER_ADMIN" || actor?.permissions.includes("MANAGE_SETTINGS")
  const audits = useQuery({ queryKey: ["audit-logs"], queryFn: () => apiRequest<Audit[]>("/audit-logs?limit=30").then((response) => response.data), enabled: Boolean(canAudit) })
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => apiRequest<Setting[]>("/settings?limit=40").then((response) => response.data), enabled: Boolean(canSettings) })
  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => apiRequest(`/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: () => {
      toast.success("Platform setting updated.")
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeading title="Governance" description="Review auditable platform actions and maintain permitted operational settings." />
      <div className="px-4 lg:px-6">
        <Tabs defaultValue={canAudit ? "audits" : "settings"}>
          <TabsList>{canAudit && <TabsTrigger value="audits">Audit Logs</TabsTrigger>}{canSettings && <TabsTrigger value="settings">Settings</TabsTrigger>}</TabsList>
          {canAudit && <TabsContent value="audits" className="mt-4">
            <Card><CardContent>
              {!audits.data?.length ? <EmptyState message="No audit activity available or access is not permitted." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Description</TableHead><TableHead>Actor</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
                  <TableBody>{audits.data.map((audit) => (
                    <TableRow key={entityId(audit)}>
                      <TableCell className="font-medium">{audit.action.replaceAll("_", " ")}</TableCell>
                      <TableCell>{audit.description}</TableCell>
                      <TableCell>{audit.actorRole?.replaceAll("_", " ") ?? "-"}</TableCell>
                      <TableCell>{new Date(audit.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>}
          {canSettings && <TabsContent value="settings" className="mt-4">
            {!settings.data?.length ? <EmptyState message="No editable settings available or access is not permitted." /> : (
              <div className="grid gap-4 md:grid-cols-2">
                {settings.data.map((setting) => (
                  <Card key={entityId(setting)}>
                    <CardHeader><CardTitle className="text-base">{setting.key}</CardTitle><CardDescription>{setting.description ?? setting.category}</CardDescription></CardHeader>
                    <CardContent>
                      <form onSubmit={(event) => {
                        event.preventDefault()
                        update.mutate({ key: setting.key, value: parseSettingValue(setting, String(new FormData(event.currentTarget).get("value"))) })
                      }}>
                        <FieldGroup>
                          <Field><FieldLabel>Value</FieldLabel><Input name="value" defaultValue={String(setting.value ?? "")} /></Field>
                          <Button variant="outline" disabled={update.isPending}>Save setting</Button>
                        </FieldGroup>
                      </form>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>}
        </Tabs>
      </div>
    </div>
  )
}
