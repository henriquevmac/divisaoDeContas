'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Money } from '@/components/Money'
import { Decimal } from '@/domain/money'
import { createPersonAction, deletePersonAction, renamePersonAction } from './actions'

export interface PersonWithBalance {
  id: string
  name: string
  isOwner: boolean
  /** Serialised for the Server → Client boundary; see lib/db/wire.ts. */
  balance: string
}

export function PeopleScreen({ people }: { people: PersonWithBalance[] }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function add(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createPersonAction(name)
      if (result?.error) {
        setError(result.error)
        return
      }
      setName('')
      setError('')
    })
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">People</h1>

      <ul className="flex flex-col gap-2">
        {people.map((person) => {
          const balance = new Decimal(person.balance)
          return (
          <li
            key={person.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <input
              aria-label={`Name for ${person.name}`}
              defaultValue={person.name}
              onBlur={(event) => {
                if (event.target.value.trim() === person.name) return
                startTransition(async () => {
                  const result = await renamePersonAction(
                    person.id,
                    event.target.value,
                  )
                  if (result?.error) setError(result.error)
                })
              }}
              className="min-w-0 flex-1 border-b border-transparent bg-transparent font-medium focus:border-neutral-400"
            />
            {person.isOwner && (
              <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">you</span>
            )}
            <Link href={`/people/${person.id}`} className="text-sm underline">
              Open
            </Link>
            <Money
              value={balance}
              className={balance.isNegative() ? 'text-green-700' : ''}
            />
            {!person.isOwner && (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const result = await deletePersonAction(person.id)
                    if (result?.error) setError(result.error)
                  })
                }
                className="text-sm text-red-700 underline"
              >
                Delete
              </button>
            )}
          </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add someone"
          className="flex-1 rounded-lg border p-3 text-base"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    </main>
  )
}
