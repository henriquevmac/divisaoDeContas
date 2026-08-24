'use client'

import { useState } from 'react'
import type { PersonRow } from '@/lib/db/types'

interface Props {
  people: PersonRow[]
  count: number
  onAssign: (personIds: string[], mode: 'replace' | 'add') => void
  onClose: () => void
}

export function AssignSheet({ people, count, onAssign, onClose }: Props) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Assign ${count} items`}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-rule bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule" />

        <h2 className="text-lg font-semibold">
          Assign {count} item{count === 1 ? '' : 's'} to…
        </h2>

        <ul className="my-4 flex flex-col">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex min-h-14 items-center gap-3 border-b border-rule text-base">
                <input
                  type="checkbox"
                  checked={chosen.has(person.id)}
                  onChange={() => toggle(person.id)}
                  className="size-5 shrink-0"
                />
                {person.name}
                {person.isOwner && <span className="eyebrow">you</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'replace')}
            className="min-h-12 rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
          >
            Assign to exactly these {chosen.size}
          </button>
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'add')}
            className="min-h-12 rounded-xl border border-rule p-3 disabled:opacity-40"
          >
            Add them, keep existing
          </button>
          <button
            type="button"
            onClick={() => onAssign([], 'replace')}
            className="min-h-12 rounded-xl border border-rule p-3 text-accent"
          >
            Unassign everyone
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 p-3 text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
