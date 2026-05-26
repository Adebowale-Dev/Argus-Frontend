import type { Role } from "@/lib/api/types"

export function homeForRole(role: Role) {
  if (role === "EXAMINER") return "/examiner/dashboard"
  if (role === "CANDIDATE") return "/candidate/dashboard"
  return "/admin/dashboard"
}

export function roleLabel(role: Role) {
  return role.replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}
