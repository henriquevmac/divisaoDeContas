'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Money } from '@/components/Money'
import { Decimal } from '@/domain/money'
import { ConfirmButton } from '@/components/ConfirmButton'
import { signOutAction } from '@/app/auth/actions'
import { createPersonAction, deletePersonAction, renamePersonAction } from './actions'

export interface PersonWithBalance {
  id: string
  name: string
  isOwner: boolean
  /** Serialised for the Server → Client boundary; see lib/db/wire.ts. */
  balance: string
}

export function PeopleScreen({
  people,
  signedInAs,
}: {
  people: PersonWithBalance[]
  signedInAs: string
}) {
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
    <main className="flex flex-col gap-5 p-4 pb-28">
      <h1 className="text-2xl font-semibold tracking-tight">People</h1>

      <ul className="flex flex-col gap-2">
        {people.map((person) => {
          const balance = new Decimal(person.balance)
          return (
          <li
            key={person.id}
            className="flex items-center gap-2 rounded-xl border border-rule bg-card p-3.5"
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
              className="min-w-0 shrink border-b border-transparent bg-transparent text-base font-medium focus:border-ink"
            />
            {person.isOwner && <span className="eyebrow shrink-0">you</span>}
            <span className="leader" aria-hidden="true" />
            <Link
              href={`/people/${person.id}`}
              aria-label={`Open ${person.name}`}
              className="shrink-0"
            >
              <Money
                value={balance}
                className={balance.isNegative() ? 'text-good' : ''}
              />
            </Link>
            {!person.isOwner && (
              <button
                type="button"
                aria-label={`Delete ${person.name}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deletePersonAction(person.id)
                    if (result?.error) setError(result.error)
                  })
                }
                className="min-h-11 shrink-0 px-1 text-sm text-muted"
              >
                ✕
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
          className="min-h-12 flex-1 rounded-xl border border-rule bg-card p-3 text-base focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-ink px-5 text-paper disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>
      )}

      <section className="mt-4">
        <h2 className="mb-2 border-b border-ink pb-1 eyebrow">Account</h2>
        <p className="mb-2 text-xs text-muted">
          Signed in as {signedInAs}. Signing out sends you back to the magic
          link, so only do it if you can receive email.
        </p>
        <ConfirmButton
          label="Sign out"
          confirmLabel="Sign out"
          pendingLabel="Signing out…"
          pending={pending}
          onConfirm={() => startTransition(async () => { await signOutAction() })}
        />
      </section>
    </main>
  )
}
