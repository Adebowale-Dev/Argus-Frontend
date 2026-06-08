import type { FormEvent } from "react"
import { toast } from "sonner"

function humanizeFieldName(name: string) {
  return name
    .replace(/^custom:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

export function toastInvalidField(event: FormEvent<HTMLFormElement>) {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return
  }

  const label = target.getAttribute("aria-label")
    || target.getAttribute("data-label")
    || (target.name ? humanizeFieldName(target.name) : "This field")

  const message = target.validity.valueMissing
    ? `${label} is required.`
    : target.validationMessage || `${label} is invalid.`

  toast.error(message)
}
