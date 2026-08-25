'use client'

import { useState, useTransition } from 'react'
import type { PersonRow } from '@/lib/db/types'
import type { ReceiptWire } from '@/lib/db/wire'

interface Props {
  receipt: ReceiptWire
  people: PersonRow[]
  onSave: (details: {
    merchant: string
    store: string
    purchasedOn: string
    payerPersonId: string
  }) => Promise<{ error: string } | undefined>
}

export function ReceiptDetailsForm({ receipt, people, onSave }: Props) {
  const [merchant, setMerchant] = useState(receipt.merchant)
  const [store, setStore] = useState(receipt.store)
  const [purchasedOn, setPurchasedOn] = useState(receipt.purchasedOn)
  const [payerPersonId, setPayerPersonId] = useState(receipt.payerPersonId)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function save(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await onSave({ merchant, store, purchasedOn, payerPersonId })
      if (result?.error) {
        setError(result.error)
        setSaved(false)
        return
      }
      setError('')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    })
  }

  const payerChanged = payerPersonId !== receipt.payerPersonId

  return (
    <details className="rounded-xl border border-rule bg-card">
      <summary className="cursor-pointer list-none p-3.5 font-medium">
        Edit details
        <span className="ml-2 text-muted">↓</span>
      </summary>

      <form onSubmit={save} className="flex flex-col gap-3 border-t border-rule p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Merchant</span>
            <input
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              className="min-h-12 rounded-lg border border-rule bg-paper p-2 text-base focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Store</span>
            <input
              value={store}
              onChange={(event) => setStore(event.target.value)}
              className="min-h-12 rounded-lg border border-rule bg-paper p-2 text-base focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Date</span>
            <input
              type="date"
              value={purchasedOn}
              onChange={(event) => setPurchasedOn(event.target.value)}
              className="min-h-12 rounded-lg border border-rule bg-paper p-2 font-mono text-base focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Paid by</span>
            <select
              value={payerPersonId}
              onChange={(event) => setPayerPersonId(event.target.value)}
              className="min-h-12 rounded-lg border border-rule bg-paper p-2 text-base focus:border-ink"
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {payerChanged && (
          <p className="rounded-lg bg-accent-soft p-2.5 text-xs text-accent">
            Changing who paid moves every debt on this receipt to that person.
            Settlements already recorded stay where they are.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
        >
          {pending ? 'Saving…' : saved ? 'Saved' : 'Save details'}
        </button>

        {error && <p className="text-sm text-accent">{error}</p>}
      </form>
    </details>
  )
}
