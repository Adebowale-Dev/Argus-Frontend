"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const chartConfig = { value: { label: "Total", color: "var(--chart-1)" } } satisfies ChartConfig

export function ArgusLineChart({ title, description, data, valueLabel, footer }: { title: string; description: string; data: Array<{ label: string; value: number }>; valueLabel: string; footer: string }) {
  const normalized = data.length ? data : [{ label: "No data", value: 0 }]
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig
  const total = normalized.reduce((sum, item) => sum + item.value, 0)
  const peak = normalized.reduce((highest, item) => item.value > highest.value ? item : highest, normalized[0])
  return <Card className="shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><ChartContainer config={config} className="h-72 w-full aspect-auto"><LineChart accessibilityLayer data={normalized} margin={{ top: 24, left: 12, right: 12 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => String(value).slice(0, 12)} /><ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} /><Line dataKey="value" type="natural" stroke="var(--color-value)" strokeWidth={2} dot={{ fill: "var(--color-value)" }} activeDot={{ r: 6 }}><LabelList position="top" offset={12} className="fill-foreground" fontSize={12} /></Line></LineChart></ChartContainer></CardContent><CardFooter className="flex-col items-start gap-2 text-sm"><div className="flex gap-2 font-medium leading-none">Peak: {peak.label} ({peak.value.toLocaleString()}) <TrendingUp className="size-4" /></div><div className="leading-none text-muted-foreground">{footer} · {total.toLocaleString()} total</div></CardFooter></Card>
}
