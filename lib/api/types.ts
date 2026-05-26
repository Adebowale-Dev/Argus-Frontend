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
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type LoginInput = { email: string; password: string }

export type CreateUserInput = {
  fullName: string
  email: string
  username?: string
  password: string
  role: Exclude<Role, "SUPER_ADMIN">
  permissions: string[]
}
