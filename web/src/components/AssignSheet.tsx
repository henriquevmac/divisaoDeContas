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
    <div className="fixed inset-0 z-10 flex flex-col justify-end bg-black/40">
      <div className="rounded-t-2xl bg-white p-4">
        <h2 className="text-lg font-semibold">
          Assign {count} item{count === 1 ? '' : 's'} to…
        </h2>

        <ul className="my-4 flex flex-col gap-1">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex items-center gap-3 rounded-lg p-3 text-base">
                <input
                  type="checkbox"
                  checked={chosen.has(person.id)}
                  onChange={() => toggle(person.id)}
                  className="size-5"
                />
                {person.name}
                {person.isOwner && <span className="text-xs text-neutral-500">you</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'replace')}
            className="rounded-lg bg-black p-3 text-white disabled:opacity-50"
          >
            Assign to exactly these {chosen.size}
          </button>
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'add')}
            className="rounded-lg border p-3 disabled:opacity-50"
          >
            Add them, keep existing
          </button>
          <button
            type="button"
            onClick={() => onAssign([], 'replace')}
            className="rounded-lg border p-3 text-red-700"
          >
            Unassign everyone
          </button>
          <button type="button" onClick={onClose} className="p-3 text-neutral-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
