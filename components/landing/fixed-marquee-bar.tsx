"use client"

const items = [
  "Public exam links",
  "6-digit exam access codes",
  "Live anti-cheat monitoring",
  "Server-side grading",
  "Examiner-owned question banks",
  "Audit-ready reports",
]

export function FixedMarqueeBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="overflow-hidden">
        <div className="animate-[marquee_28s_linear_infinite] whitespace-nowrap py-3 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {[...items, ...items].map((item, index) => <span key={`${item}-${index}`} className="mx-5 inline-block">{item}</span>)}
        </div>
      </div>
    </div>
  )
}
