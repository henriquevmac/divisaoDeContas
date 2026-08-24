'use client'

import { useState } from 'react'

interface Props {
  label: string
  confirmLabel: string
  pendingLabel?: string
  pending?: boolean
  onConfirm: () => void
}

/**
 * A destructive action that takes two deliberate presses. Inline rather than a
 * native confirm() dialog, which on a phone is easy to dismiss by accident and
 * cannot explain what is about to happen.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  pendingLabel,
  pending = false,
  onConfirm,
}: Props) {
  const [armed, setArmed] = useState(false)

  if (pending) {
    return (
      <button
        type="button"
        disabled
        className="min-h-11 w-full rounded-xl border border-rule p-3 text-muted"
      >
        {pendingLabel ?? label}
      </button>
    )
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="min-h-11 w-full rounded-xl border border-rule p-3 text-muted"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-11 flex-1 rounded-xl border border-rule p-3 text-ink"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="min-h-11 flex-1 rounded-xl bg-accent p-3 text-paper"
      >
        {confirmLabel}
      </button>
    </div>
  )
}
