"use client"

import { useEffect, useRef, useSyncExternalStore, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { IconAlertTriangle, IconCamera, IconClock, IconMaximize, IconPhoto, IconShieldLock } from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { toast } from "sonner"

import { ExamDeviceBlocked, useExamDeviceBlocked } from "@/components/candidate/exam-device-guard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { apiRequest, ApiRequestError, attemptRequest, getAttemptToken, getSession, serverUrl } from "@/lib/api/client"
import type { AttemptSession, Question } from "@/lib/api/types"

type ViolationResponse = { action: string; attemptStatus: string; violationScore: number; reason?: string }

function useSecondClock() {
  return useSyncExternalStore(
    (callback) => {
      const interval = window.setInterval(callback, 1000)
      return () => window.clearInterval(interval)
    },
    () => Math.floor(Date.now() / 1000),
    () => 0
  )
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`
}

export function AttemptRoom() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const router = useRouter()
  const blockedDevice = useExamDeviceBlocked()
  const clock = useSecondClock()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const expiryReported = useRef(false)
  const session = useQuery({ queryKey: ["attempt", attemptId], queryFn: () => {
    const publicToken = getAttemptToken(attemptId)
    return publicToken
      ? attemptRequest<AttemptSession>(attemptId, `/attempts/${attemptId}`).then((response) => response.data)
      : apiRequest<AttemptSession>(`/attempts/${attemptId}`).then((response) => response.data)
  }, retry: false })
  const attempt = session.data?.attempt
  const settings = session.data?.exam?.antiCheatSettings
  const questions = session.data?.questions ?? []
  const question = questions[currentIndex]
  const remaining = attempt && clock ? Math.max(0, Math.floor(new Date(attempt.expiresAt).getTime() / 1000) - clock) : 0
  const progress = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0

  const save = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string[] }) => attemptRequest(attemptId, `/attempts/${attemptId}/save-answer`, {
      method: "POST",
      body: JSON.stringify({ questionId, answer, currentQuestionIndex: currentIndex }),
    }),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const submit = useMutation({
    mutationFn: () => attemptRequest(attemptId, `/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers: questions.map((item) => ({ questionId: item.id ?? item._id, answer: answerForQuestion(item) })) }),
    }),
    onSuccess: () => {
      toast.success("Your examination has been submitted.")
      router.replace(`/candidate/attempts/${attemptId}/result`)
    },
    onError: (error: ApiRequestError) => toast.error(error.message),
  })
  const violation = useMutation({
    mutationFn: ({ eventType, description, metadata }: { eventType: string; description: string; metadata?: Record<string, unknown> }) => attemptRequest<ViolationResponse>(attemptId, `/attempts/${attemptId}/anti-cheat/log`, {
      method: "POST",
      body: JSON.stringify({ eventType, description, questionIndex: currentIndex, timeRemaining: remaining, metadata }),
    }),
    onSuccess: (response) => {
      if (response.data.action === "AUTO_SUBMIT") {
        toast.error(response.data.reason ?? "The exam was automatically submitted.")
        router.replace(`/candidate/attempts/${attemptId}/result`)
      } else if (response.data.action === "WARNING" || response.data.action === "FINAL_WARNING") {
        toast.warning(`Integrity warning: ${response.data.action.replace("_", " ")}`)
      }
    },
  })
  const evidence = useMutation({
    mutationFn: ({ kind, file }: { kind: "snapshot" | "screenshot"; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      return attemptRequest(attemptId, `/attempts/${attemptId}/${kind}`, { method: "POST", body: form })
    },
    onSuccess: () => toast.success("Monitoring evidence submitted."),
    onError: (error: ApiRequestError) => toast.error(error.message),
  })

  useEffect(() => {
    if (blockedDevice) return
    const token = getSession()?.accessToken
    if (!token || attempt?.status !== "IN_PROGRESS") return
    const socket = io(serverUrl, { auth: { token } })
    socket.emit("candidate:join-exam", { attemptId })
    const heartbeat = window.setInterval(() => socket.emit("candidate:heartbeat", { attemptId }), 15000)
    return () => {
      window.clearInterval(heartbeat)
      socket.emit("candidate:leave-exam", { attemptId })
      socket.disconnect()
    }
  }, [attempt?.status, attemptId, blockedDevice])

  useEffect(() => {
    if (blockedDevice) return
    if (attempt?.status !== "IN_PROGRESS") return
    const interval = window.setInterval(() => {
      attemptRequest(attemptId, `/attempts/${attemptId}/heartbeat`, { method: "POST", body: JSON.stringify({ currentQuestionIndex: currentIndex }) }).catch(() => undefined)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [attempt?.status, attemptId, currentIndex, blockedDevice])

  useEffect(() => {
    if (blockedDevice) return
    if (attempt?.status !== "IN_PROGRESS" || !clock || remaining > 0 || expiryReported.current) return
    expiryReported.current = true
    attemptRequest(attemptId, `/attempts/${attemptId}/heartbeat`, { method: "POST", body: JSON.stringify({ currentQuestionIndex: currentIndex }) })
      .catch(() => router.replace(`/candidate/attempts/${attemptId}/result`))
  }, [attempt?.status, attemptId, clock, currentIndex, remaining, router, blockedDevice])

  useEffect(() => {
    if (blockedDevice) return
    if (attempt?.status !== "IN_PROGRESS") return
    const record = (eventType: string, description: string, metadata?: Record<string, unknown>) => violation.mutate({ eventType, description, metadata })
    const visibility = () => { if (document.hidden && settings?.detectTabSwitch !== false) record("TAB_SWITCHED", "Candidate switched away from the examination tab.") }
    const fullscreen = () => { if (!document.fullscreenElement && settings?.requireFullscreen) record("FULLSCREEN_EXITED", "Candidate exited fullscreen mode.") }
    const blur = () => { if (settings?.detectWindowBlur !== false) record("WINDOW_BLUR", "Examination window lost focus.") }
    const copy = (event: ClipboardEvent) => { if (settings?.disableCopyPaste !== false) { event.preventDefault(); record("COPY_ATTEMPT", "Copy action attempted.") } }
    const paste = (event: ClipboardEvent) => { if (settings?.disableCopyPaste !== false) { event.preventDefault(); record("PASTE_ATTEMPT", "Paste action attempted.") } }
    const cut = (event: ClipboardEvent) => { if (settings?.disableCopyPaste !== false) { event.preventDefault(); record("CUT_ATTEMPT", "Cut action attempted.") } }
    const contextMenu = (event: MouseEvent) => { if (settings?.disableRightClick !== false) { event.preventDefault(); record("RIGHT_CLICK_ATTEMPT", "Context menu access attempted.") } }
    const keyboard = (event: KeyboardEvent) => {
      const shortcut = event.ctrlKey || event.metaKey
      if (shortcut && event.key.toLowerCase() === "p") { event.preventDefault(); record("PRINT_ATTEMPT", "Print shortcut attempted.") }
      if (shortcut && event.key.toLowerCase() === "s") { event.preventDefault(); record("SAVE_ATTEMPT", "Save shortcut attempted.") }
      if (event.key === "F5" || (shortcut && event.key.toLowerCase() === "r")) { event.preventDefault(); record("PAGE_REFRESH_ATTEMPT", "Page refresh shortcut attempted.") }
      if (settings?.blockDevToolsShortcuts && (event.key === "F12" || (shortcut && event.shiftKey && ["i", "j", "c"].includes(event.key.toLowerCase())))) {
        event.preventDefault()
        record("DEVTOOLS_ATTEMPT", "Developer tools shortcut attempted.")
      }
    }
    const beforePrint = () => record("PRINT_ATTEMPT", "Print dialog attempted.")
    const browserBack = () => record("BROWSER_BACK_ATTEMPT", "Browser navigation was attempted during the examination.")
    document.addEventListener("visibilitychange", visibility)
    document.addEventListener("fullscreenchange", fullscreen)
    window.addEventListener("blur", blur)
    document.addEventListener("copy", copy)
    document.addEventListener("paste", paste)
    document.addEventListener("cut", cut)
    document.addEventListener("contextmenu", contextMenu)
    document.addEventListener("keydown", keyboard)
    window.addEventListener("beforeprint", beforePrint)
    window.addEventListener("popstate", browserBack)
    return () => {
      document.removeEventListener("visibilitychange", visibility)
      document.removeEventListener("fullscreenchange", fullscreen)
      window.removeEventListener("blur", blur)
      document.removeEventListener("copy", copy)
      document.removeEventListener("paste", paste)
      document.removeEventListener("cut", cut)
      document.removeEventListener("contextmenu", contextMenu)
      document.removeEventListener("keydown", keyboard)
      window.removeEventListener("beforeprint", beforePrint)
      window.removeEventListener("popstate", browserBack)
    }
  }, [attempt?.status, currentIndex, remaining, settings, violation, blockedDevice])

  function selectAnswer(item: Question, values: string[]) {
    const id = item.id ?? item._id ?? ""
    setAnswers((current) => ({ ...current, [id]: values }))
    save.mutate({ questionId: id, answer: values })
  }

  function answerForQuestion(item: Question) {
    const id = item.id ?? item._id ?? ""
    return answers[id] ?? attempt?.answers?.find((saved) => String(saved.question) === id)?.answer ?? []
  }

  if (session.isPending) return <div className="p-6 text-sm text-muted-foreground">Loading secure attempt...</div>
  if (!attempt || !question) return <div className="p-6"><Alert variant="destructive"><IconAlertTriangle /><AlertTitle>Attempt unavailable</AlertTitle><AlertDescription>This attempt cannot be loaded or is no longer in progress.</AlertDescription></Alert></div>
  if (blockedDevice) return <ExamDeviceBlocked returnHref="/exam" returnLabel="Return to exam finder" />

  const answer = answerForQuestion(question)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Secure attempt</p>
            <h1 className="text-xl font-semibold">{session.data?.exam?.title ?? "Live examination"}</h1>
            <p className="text-sm text-muted-foreground">Auto-save is active. Integrity monitoring remains enabled throughout the session.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline"><IconShieldLock /> Desktop only</Badge>
            <Badge variant={remaining < 300 ? "destructive" : "outline"}><IconClock /> {clock ? formatTime(remaining) : "--:--"} remaining</Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Secure examination attempt</h2><p className="text-sm text-muted-foreground">Answers save automatically as you select them.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {settings?.requireFullscreen && <Button size="sm" variant="outline" onClick={() => document.documentElement.requestFullscreen().catch(() => toast.error("Fullscreen permission was declined."))}><IconMaximize /> Fullscreen</Button>}
          {settings?.captureSnapshots && <EvidenceButton icon={<IconCamera />} label="Snapshot" kind="snapshot" onFile={(kind, file) => evidence.mutate({ kind, file })} />}
          {settings?.captureScreenshots && <EvidenceButton icon={<IconPhoto />} label="Screenshot" kind="screenshot" onFile={(kind, file) => evidence.mutate({ kind, file })} />}
          <Badge variant="outline"><IconShieldLock /> Monitored</Badge><Badge variant="outline">Auto-save on</Badge>
        </div>
      </div>
      <Progress value={progress} />
      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_16rem]">
        <Card>
          <CardHeader><CardTitle className="text-lg">Question {currentIndex + 1} of {questions.length}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-base leading-7">{question.questionText}</p>
            {question.questionType === "MULTIPLE_CHOICE" ? (
              <div className="space-y-3">{question.options.map((option) => <label className="flex items-center gap-3 rounded-lg border p-3" key={option.key}><Checkbox checked={answer.includes(option.key)} onCheckedChange={(checked) => selectAnswer(question, checked ? [...answer, option.key] : answer.filter((item) => item !== option.key))} />{option.text}</label>)}</div>
            ) : (
              <RadioGroup value={answer[0]} onValueChange={(value) => selectAnswer(question, [value])}>{question.options.map((option) => <label className="flex items-center gap-3 rounded-lg border p-3" key={option.key}><RadioGroupItem value={option.key} />{option.text}</label>)}</RadioGroup>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Navigation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">{questions.map((item, index) => {
              const id = item.id ?? item._id ?? ""
              return <Button key={id} size="icon-sm" variant={index === currentIndex ? "default" : answerForQuestion(item).length ? "secondary" : "outline"} onClick={() => setCurrentIndex(index)}>{index + 1}</Button>
            })}</div>
            <div className="flex gap-2"><Button variant="outline" disabled={!currentIndex} onClick={() => setCurrentIndex((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex((value) => value + 1)}>Next</Button></div>
            <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? "Submitting..." : "Submit exam"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EvidenceButton({ icon, label, kind, onFile }: { icon: ReactNode; label: string; kind: "snapshot" | "screenshot"; onFile: (kind: "snapshot" | "screenshot", file: File) => void }) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent">
      {icon} {label}
      <input type="file" accept="image/*" capture={kind === "snapshot" ? "user" : undefined} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(kind, file); event.target.value = "" }} />
    </label>
  )
}
