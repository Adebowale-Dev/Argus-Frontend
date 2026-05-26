"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { IconDeviceLaptop, IconDeviceMobile, IconShieldLock } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function detectBlockedDevice() {
  if (typeof window === "undefined") return false
  const userAgent = navigator.userAgent || ""
  const touchDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  const narrowViewport = window.matchMedia("(max-width: 1023px)").matches
  return touchDevice || narrowViewport
}

export function useExamDeviceBlocked() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const sync = () => setBlocked(detectBlockedDevice())
    sync()
    window.addEventListener("resize", sync)
    return () => window.removeEventListener("resize", sync)
  }, [])

  return blocked
}

export function ExamDeviceBlocked({ returnHref = "/", returnLabel = "Back to landing" }: { returnHref?: string; returnLabel?: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <Card className="w-full border-border/70 bg-card/95 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconDeviceMobile className="size-7" />
          </div>
          <CardTitle className="text-2xl">Desktop required for secure exam sessions</CardTitle>
          <CardDescription className="mx-auto max-w-xl text-sm leading-7">
            ARGUS blocks exam-taking on mobile devices and narrow screens so fullscreen monitoring, question navigation, and anti-cheat controls work reliably.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border bg-muted/35 p-4 text-sm">
              <IconShieldLock className="mb-3 size-5 text-primary" />
              <p className="font-medium">Integrity protection</p>
              <p className="mt-2 text-muted-foreground">Fullscreen and focus monitoring are designed for desktop-class browsers.</p>
            </div>
            <div className="rounded-2xl border bg-muted/35 p-4 text-sm">
              <IconDeviceLaptop className="mb-3 size-5 text-primary" />
              <p className="font-medium">Use a laptop or desktop</p>
              <p className="mt-2 text-muted-foreground">Open the exam on a larger screen with stable internet before attempting to start.</p>
            </div>
            <div className="rounded-2xl border bg-muted/35 p-4 text-sm">
              <IconDeviceMobile className="mb-3 size-5 text-primary" />
              <p className="font-medium">No mobile bypass</p>
              <p className="mt-2 text-muted-foreground">This exam cannot be started or continued on phones or other mobile-sized devices.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={returnHref}>{returnLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
