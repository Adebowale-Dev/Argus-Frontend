export type Role = "SUPER_ADMIN" | "SUB_ADMIN" | "EXAMINER" | "CANDIDATE"

export type AuthUser = {
  id: string
  fullName: string
  email: string
  role: Role
  permissions: string[]
  mustChangePassword: boolean
}

export type Session = {
  user: AuthUser
  accessToken: string
}

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  errors?: Array<Record<string, unknown>>
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type LoginInput = { identifier: string; password: string }
export type RegisterExaminerInput = { fullName: string; email: string; username?: string; password: string }

export type CreateUserInput = {
  fullName: string
  email: string
  username?: string
  password: string
  role: Exclude<Role, "SUPER_ADMIN">
  permissions: string[]
}
export type ExamInvite = {
  id?: string
  _id?: string
  email: string
  fullName?: string
  identifier?: string
  metadata?: Record<string, string | number | boolean>
  status: "APPROVED" | "VERIFIED" | "STARTED" | "COMPLETED" | "REVOKED"
  verifiedAt?: string
  createdAt?: string
  lastUsedAt?: string
}

export type Paginated<T> = ApiEnvelope<T[]>
export type UserStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED" | "DELETED"
export type ResourceStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED" | "DELETED"
export type ExamStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "DISABLED" | "CANCELLED" | "ARCHIVED"
export type AttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "LOCKED" | "FLAGGED" | "CANCELLED" | "EXPIRED"

export type User = AuthUser & {
  _id?: string
  username?: string
  status: UserStatus
  lastLoginAt?: string
  createdAt?: string
  profileImage?: string
  metadata?: Record<string, unknown>
}

export type Department = {
  _id?: string
  id?: string
  name: string
  code: string
  description?: string
  status: ResourceStatus
}

export type Course = {
  _id?: string
  id?: string
  title: string
  code: string
  description?: string
  department: Department | string
  examiners?: User[]
  candidates?: User[]
  status: ResourceStatus
}

export type QuestionOption = { key: string; text: string }
export type QuestionBank = {
  _id?: string
  id?: string
  title: string
  description?: string
  owner?: User | string
  tags?: string[]
  visibility: "PRIVATE" | "SHARED" | "ARCHIVED"
  status: ResourceStatus
  questionCount?: number
  questions?: Question[]
  createdAt?: string
  updatedAt?: string
}
export type Question = {
  _id?: string
  id?: string
  questionBank?: QuestionBank | string
  course?: Course | string
  questionText: string
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SINGLE_SELECT"
  options: QuestionOption[]
  correctAnswer?: string[]
  marks: number
  topic?: string
  tags?: string[]
  explanation?: string
  attachments?: Array<{ publicId?: string; url?: string; originalName?: string }>
  status: ResourceStatus
}

export type AntiCheatSettings = {
  requireFullscreen?: boolean
  detectTabSwitch?: boolean
  detectWindowBlur?: boolean
  disableRightClick?: boolean
  disableCopyPaste?: boolean
  blockDevToolsShortcuts?: boolean
  preventMultipleSessions?: boolean
  requireWebcam?: boolean
  captureSnapshots?: boolean
  captureScreenshots?: boolean
  snapshotIntervalSeconds?: number
  screenshotIntervalSeconds?: number
  maxTabSwitches?: number
  maxFullscreenExits?: number
  maxWindowBlurEvents?: number
  maxRefreshAttempts?: number
  autoSubmitViolationScore?: number
  warningViolationScore?: number
  finalWarningViolationScore?: number
  maxAwaySeconds?: number
}

export type Exam = {
  _id?: string
  id?: string
  title: string
  code?: string
  questionBank?: QuestionBank | string
  course?: Course | string
  description?: string
  instructions?: string
  durationMinutes: number
  startTime: string
  endTime: string
  publicUrl?: string
  publicSlug?: string
  accessType?: "PUBLIC_LINK_WITH_CODE" | "LOGIN_REQUIRED_WITH_CODE" | "INVITE_ONLY"
  availabilityMode?: "ALWAYS_OPEN" | "SCHEDULED" | "CLOSED_MANUALLY"
  candidateIdentityRequirements?: {
    fullName: boolean
    email: boolean
    phone: boolean
    identifier: boolean
    customFields?: Array<{ key: string; label: string; type: "text" | "email" | "tel" | "number"; placeholder?: string; required?: boolean }>
  }
  questions?: Array<Question | string>
  totalMarks?: number
  passMark?: number
  assignedCandidates?: User[]
  invites?: ExamInvite[]
  status: ExamStatus
  showResultImmediately?: boolean
  randomizeQuestions?: boolean
  randomizeOptions?: boolean
  maxAttempts?: number
  antiCheatSettings?: AntiCheatSettings
  createdAt?: string
  updatedAt?: string
  accessCodeLastGeneratedAt?: string
  accessCodeRegeneratedCount?: number
}

export type ExamAccessInfo = {
  _id?: string
  id?: string
  title: string
  code?: string
  publicUrl?: string
  publicSlug?: string
  accessCodeLastGeneratedAt?: string
  accessCodeRegeneratedCount?: number
  accessType?: "PUBLIC_LINK_WITH_CODE" | "LOGIN_REQUIRED_WITH_CODE" | "INVITE_ONLY"
  status: ExamStatus
  publishedAt?: string
}

export type Attempt = {
  _id?: string
  id?: string
  exam: Exam | string
  candidate?: User
  candidateProfile?: { fullName: string; email?: string; phone?: string; identifier?: string; metadata?: Record<string, unknown> }
  accessChannel?: "ACCOUNT" | "VERIFIED_OR_PUBLIC"
  status: AttemptStatus
  answers?: Array<{ question: string; answer: string[] }>
  expiresAt: string
  score?: number
  totalMarks?: number
  percentage?: number
  passed?: boolean
  violationScore?: number
  warningCount?: number
  autoSubmitReason?: string
  retakeGrantedAt?: string
  retakeGrantReason?: string
}

export type AttemptSession = {
  attempt: Attempt
  attemptToken?: string
  questions: Question[]
  exam?: {
    id: string
    title: string
    expiresAt: string
    antiCheatSettings?: AntiCheatSettings
  }
}

export type AntiCheatLog = {
  _id?: string
  id?: string
  eventType: string
  severity: string
  points: number
  systemAction: string
  description?: string
  createdAt: string
  candidate?: User
  evidence?: { publicId?: string }
}

export type AdminDashboard = {
  summary: {
    activeUsers: number
    totalExams: number
    totalAttempts: number
    antiCheatEvents: number
    totalInvites?: number
    verifiedInvites?: number
  }
  charts?: {
    examStatus?: Array<{ status: string; total: number }>
    inviteFunnel?: Array<{ label: string; total: number }>
  }
  recentFlaggedAttempts: Array<{
    id: string
    examTitle?: string
    examCode?: string
    candidateName: string
    candidateEmail?: string
    status: AttemptStatus
    violationScore: number
    updatedAt?: string
  }>
  recentExams: Array<{
    id: string
    title: string
    code?: string
    status: ExamStatus
    publicUrl?: string
    createdAt?: string
  }>
}

export type ExaminerDashboard = {
  summary: {
    questionBanks: number
    totalExams: number
    publishedExams: number
    activeAttempts: number
    flaggedAttempts: number
  }
  charts?: {
    invites?: Array<{ status: string; total: number }>
    outcomes?: Array<{ outcome: string; total: number }>
  }
  recentExams: Array<{
    id: string
    title: string
    code?: string
    status: ExamStatus
    publicUrl?: string
    createdAt?: string
  }>
}

export type CandidateDashboard = {
  summary: {
    assignedCount: number
    availableCount: number
    inProgressCount: number
    completedCount: number
  }
  nextExam: {
    id: string
    title: string
    code?: string
    status: ExamStatus
    startTime?: string
    endTime?: string
    durationMinutes: number
  } | null
  assignedExams: Array<{
    id: string
    title: string
    code?: string
    status: ExamStatus
    startTime?: string
    endTime?: string
    durationMinutes: number
  }>
  activeAttempt: {
    id: string
    examTitle?: string
    examCode?: string
    expiresAt?: string
    status: AttemptStatus
  } | null
  completedAttempts: Array<{
    id: string
    examTitle?: string
    examCode?: string
    score?: number
    percentage?: number
    passed?: boolean
    submittedAt?: string
    status: AttemptStatus
  }>
}


