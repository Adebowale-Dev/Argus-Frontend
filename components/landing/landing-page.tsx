"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Link2,
  ScanSearch,
  ShieldCheck,
  TimerReset,
  Trophy,
  UserRoundSearch,
} from "lucide-react";

import { ArgusMark } from "@/components/brand/argus-mark";
import { FixedMarqueeBar } from "@/components/landing/fixed-marquee-bar";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { currentUser, getSession, subscribeToSession } from "@/lib/api/client";
import { homeForRole, roleLabel } from "@/lib/auth/routing";

const steps = [
  {
    title: "Create",
    description:
      "Examiners create private question banks, compose exams, and publish secure public access links.",
    icon: ClipboardCheck,
  },
  {
    title: "Verify",
    description:
      "Candidates open the exam link, enter the 6-digit code, and fill the exact details the examiner requires.",
    icon: UserRoundSearch,
  },
  {
    title: "Monitor",
    description:
      "ARGUS tracks timing, focus loss, tab switching, and violation scoring in real time.",
    icon: ShieldCheck,
  },
];

const progressCards = [
  { title: "Public link access", meta: "No department setup", icon: Link2 },
  {
    title: "Anti-cheat engine",
    meta: "Warnings + auto-submit",
    icon: ShieldCheck,
  },
  { title: "Instant grading", meta: "Server authoritative", icon: Trophy },
  { title: "Exam analytics", meta: "Reports and oversight", icon: BarChart3 },
];

const roleCards = [
  {
    title: "For candidates",
    copy: "Open your exam link, enter the secure code, complete the requested identity fields, and take the exam with confidence.",
    cta: { href: "/exam", label: "Take an exam" },
  },
  {
    title: "For examiners",
    copy: "Sign in to build question banks, publish assessment links, manage verified invite lists, and monitor attempts from one workspace.",
    cta: { href: "/login", label: "Examiner sign in" },
  },
];

export function LandingPage() {
  const hasSession = useSyncExternalStore(subscribeToSession, () => Boolean(getSession()), () => false);
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    enabled: hasSession,
    retry: false,
  });
  const primaryHref = user ? homeForRole(user.role) : "/exam";
  const primaryLabel = user ? "Go to dashboard" : "Take an exam";
  const secondaryHref = user ? "/exam" : "/login";
  const secondaryLabel = user ? "Open exam finder" : "Examiner sign in";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_34%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.45))] pb-28 md:pb-32">
      <LandingNavbar />

      <main>
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pt-16 pb-24 text-center sm:pt-20 sm:pb-28 lg:px-6 lg:pt-28 lg:pb-32">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              <ScanSearch className="size-3.5" />
              Secure online examinations for any organization
            </div>

            <h1 className="mb-6 max-w-5xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-foreground">Secure exams.</span>{" "}
              <span className="text-primary">
                Simple for candidates. Powerful for examiners.
              </span>
            </h1>

            <p className="mb-8 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              ARGUS helps examiners create secure assessments, lets candidates
              start with the exact information required by the lecturer, and
              gives admins full visibility without turning the platform into a
              school-only system.
            </p>

            {user && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-sm shadow-sm">
                <span className="font-medium">{user.fullName}</span>
                <span className="text-muted-foreground">
                  is signed in as {roleLabel(user.role)}
                </span>
              </div>
            )}

            <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="shadow-md">
                <Link href={primaryHref}>
                  {primaryLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            </div>

            <div className="relative mx-auto w-full max-w-5xl">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur">
                <div className="flex items-center justify-between border-b bg-background/70 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-2.5 rounded-full bg-red-400" />
                    <div className="size-2.5 rounded-full bg-amber-400" />
                    <div className="size-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground">
                    ARGUS / secure exam session
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3 text-primary" />
                    <span>Protected</span>
                  </div>
                </div>

                <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-border">
                  <div className="space-y-4 p-6">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Exam access
                    </p>
                    <div>
                      <p className="text-2xl font-semibold">
                        Public link + 6-digit code
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Candidates verify first, then start securely.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                      <Link2 className="size-3" />
                      Verified entry flow
                    </div>
                  </div>

                  <div className="space-y-4 p-6">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Candidate intake
                    </p>
                    <div className="space-y-2 text-sm">
                      {[
                        ["Full name", "Required"],
                        ["Email", "Required"],
                        ["Custom lecturer fields", "Supported"],
                        ["Terms acceptance", "Required"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 p-6">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Monitoring
                    </p>
                    <div>
                      <p className="text-3xl font-semibold">Live</p>
                      <p className="text-sm text-muted-foreground">
                        Warnings, violation score, and automatic submission if
                        thresholds are crossed.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TimerReset className="size-3 text-primary" />
                      <span>Server-controlled timer</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t bg-muted/35 px-6 py-4">
                  <p className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Signals
                  </p>
                  <div className="flex h-2 flex-1 gap-1 overflow-hidden rounded-full">
                    <div className="w-[32%] bg-primary" />
                    <div className="w-[43%] bg-emerald-500/80" />
                    <div className="w-[25%] bg-amber-500/80" />
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    focus · integrity · completion
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-6"
        >
          <div className="mb-6 max-w-2xl space-y-2">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              How it works
            </p>
            <h2 className="text-3xl font-medium tracking-[-0.04em] text-foreground">
              Designed for real-world assessments, not academic bureaucracy.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(({ title, description, icon: Icon }) => (
              <Card
                key={title}
                className="border-border/70 bg-card/80 shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="platform"
          className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-6"
        >
          <div className="overflow-hidden rounded-[1.2rem] bg-[#1f211c] p-5 text-white shadow-[0_24px_70px_rgba(17,24,39,0.18)] md:p-8">
            <div className="grid gap-6 md:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-[0.16em] text-white/60 uppercase">
                  Platform flow
                </p>
                <h2 className="text-3xl font-medium tracking-[-0.04em]">
                  A clean secure pipeline from exam publishing to graded
                  results.
                </h2>
                <p className="max-w-lg text-sm leading-7 text-white/72">
                  Examiners publish from their own question banks. Candidates
                  use a public exam link and code. ARGUS verifies access,
                  collects required identity fields, monitors the session,
                  grades on the backend, and keeps the full attempt timeline
                  ready for reports.
                </p>
                <div className="flex flex-wrap gap-2 text-xs tracking-[0.15em] text-white/84 uppercase">
                  <span className="rounded-md bg-white/10 px-3 py-1.5">
                    Question banks
                  </span>
                  <span className="rounded-md bg-white/10 px-3 py-1.5">
                    Public access verification
                  </span>
                  <span className="rounded-md bg-white/10 px-3 py-1.5">
                    Anti-cheat engine
                  </span>
                </div>
              </div>
              <div className="rounded-[1rem] bg-white/5 p-4 font-mono text-sm">
                {[
                  "question bank -> exam draft",
                  "publish -> public slug + access code",
                  "candidate -> verify code",
                  "required details -> attempt start",
                  "monitoring -> warnings / auto-submit",
                  "submission -> grading -> reports",
                ].map((row, index) => (
                  <div
                    key={row}
                    className="mb-3 flex items-center gap-3 rounded-[0.85rem] bg-black/18 px-4 py-3 text-white/78 last:mb-0"
                  >
                    <span className="text-white/40">0{index + 1}</span>
                    <span>{row}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="roles"
          className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-6"
        >
          <div className="mb-6 max-w-2xl space-y-2">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Entry points
            </p>
            <h2 className="text-3xl font-medium tracking-[-0.04em] text-foreground">
              Two clear ways to get started.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {roleCards.map((card) => (
              <Card
                key={card.title}
                className="border-border/70 bg-card/85 shadow-sm"
              >
                <CardContent className="p-6">
                  <h3 className="text-2xl font-medium">{card.title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    {card.copy}
                  </p>
                  <div className="mt-5">
                    <Button asChild size="lg">
                      <Link href={card.cta.href}>
                        {card.cta.label}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-6">
          <div className="mb-6 max-w-2xl space-y-2">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Core value
            </p>
            <h2 className="text-3xl font-medium tracking-[-0.04em] text-foreground">
              Professional controls without needless complexity.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {progressCards.map(({ title, meta, icon: Icon }) => (
              <Card
                key={title}
                className="border-border/70 bg-card/80 shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                      Active
                    </span>
                  </div>
                  <p className="text-xl font-medium text-foreground">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{meta}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-12 lg:px-6">
          <div className="overflow-hidden rounded-[1.1rem] bg-primary p-5 text-primary-foreground shadow-[0_20px_50px_rgba(17,24,39,0.18)] md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-[0.16em] text-primary-foreground/75 uppercase">
                  Ready to start
                </p>
                <h2 className="text-2xl font-medium tracking-[-0.03em]">
                  Candidates can begin with a shared exam link. Examiners can
                  start authoring in minutes.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-primary-foreground/85">
                  ARGUS is built for training teams, schools, tutors,
                  recruiters, and any organization that needs a secure online
                  testing workflow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  className="bg-white px-5 text-primary hover:bg-white/90"
                >
                  <Link href={primaryHref}>
                    {primaryLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/40 bg-transparent px-5 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                >
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <div className="rounded-2xl border border-border/60 bg-background/95 px-6 py-8 shadow-sm backdrop-blur-sm sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr] lg:gap-12">
            <div className="space-y-4">
              <ArgusMark />
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                A secure examination platform for public-link assessments,
                examiner-owned question banks, and monitored online testing.
              </p>
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">
                Smart exam delivery with accountable monitoring.
              </p>
            </div>
            <div className="grid gap-8 text-sm sm:grid-cols-3">
              <FooterGroup
                title="Product"
                links={[
                  { href: "/exam", label: "Take an exam" },
                  { href: "/login", label: "Login" },
                  { href: "/login", label: "Examiner sign in" },
                ]}
              />
              <FooterGroup
                title="Platform"
                links={[
                  { href: "#how-it-works", label: "How it works" },
                  { href: "#platform", label: "Security flow" },
                  { href: "#roles", label: "User roles" },
                ]}
              />
              <FooterGroup
                title="ARGUS"
                links={[
                  { href: "/admin/dashboard", label: "Admin workspace" },
                  { href: "/examiner/dashboard", label: "Examiner workspace" },
                  {
                    href: "/candidate/dashboard",
                    label: "Candidate workspace",
                  },
                ]}
              />
            </div>
          </div>
          <div className="mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} ARGUS. Secure assessments, public exam
            links, and professional anti-cheat monitoring.
          </div>
        </div>
      </footer>

      <FixedMarqueeBar />
    </div>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-foreground/80 uppercase">
        {title}
      </h3>
      <ul className="space-y-2 text-muted-foreground">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
