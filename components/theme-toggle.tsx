"use client"

import { flushSync } from "react-dom"
import { useSyncExternalStore } from "react"
import { IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> }
}

export function AnimatedThemeToggler({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false)

  const toggleTheme = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
    const documentWithTransition = document as ViewTransitionDocument

    if (!documentWithTransition.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    const transition = documentWithTransition.startViewTransition(() => {
      flushSync(() => setTheme(nextTheme))
    })
    await transition.ready

    const x = event.clientX
    const y = event.clientY
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 500, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("relative size-8 overflow-hidden", className)}
      aria-label={mounted ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme` : "Toggle theme"}
      disabled={!mounted}
      onClick={toggleTheme}
    >
      <IconSun className="size-4 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <IconMoon className="absolute size-4 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
    </Button>
  )
}

export const ThemeToggle = AnimatedThemeToggler
