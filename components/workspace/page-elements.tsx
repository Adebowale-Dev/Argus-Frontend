import { IconInbox } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ")
  return <Badge variant={status === "ACTIVE" || status === "SUBMITTED" ? "default" : "outline"}>{label}</Badge>
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
        <IconInbox className="size-8" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  )
}

export function entityId(entity: { id?: string; _id?: string }) {
  return entity.id ?? entity._id ?? ""
}
