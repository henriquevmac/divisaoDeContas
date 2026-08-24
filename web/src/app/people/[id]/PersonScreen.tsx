'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Decimal } from '@/domain/money'
import { Money } from '@/components/Money'
import { recordSettlementAction } from './actions'
import type { SettlementWire, ShareWire } from '@/lib/db/wire'

interface Props {
  personId: string
  name: string
  shares: ShareWire[]
  settlements: SettlementWire[]
  /** Money crosses the Server → Client boundary as strings; see lib/db/wire.ts. */
  shareTotal: string
  settledTotal: string
  balance: string
}

export function PersonScreen({
  personId,
  name,
  shares,
  settlements,
  shareTotal,
  settledTotal,
  balance,
}: Props) {
  const balanceValue = new Decimal(balance)
  const [amount, setAmount] = useState(
    balanceValue.toDecimalPlaces(2).toString().replace('.', ','),
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function settle(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await recordSettlementAction(
        personId,
        amount,
        new Date().toISOString().slice(0, 10),
        note,
      )
      if (result?.error) {
        setError(result.error)
        return
      }
      setError('')
      setNote('')
    })
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-24">
      <header>
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-3xl font-semibold tabular-nums">
          <Money
            value={balanceValue}
            className={balanceValue.isNegative() ? 'text-green-700' : ''}
          />
        </p>
        <p className="text-sm text-neutral-600">
          <Money value={new Decimal(shareTotal)} /> in shares less{' '}
          <Money value={new Decimal(settledTotal)} /> settled
          {balanceValue.isNegative() && ' — they are in credit'}
        </p>
      </header>

      <form onSubmit={settle} className="flex flex-col gap-2 rounded-lg border p-3">
        <h2 className="text-sm font-semibold text-neutral-600">Record a settlement</h2>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="w-28 rounded border p-2 text-right text-base tabular-nums"
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            className="flex-1 rounded border p-2 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {pending ? 'Recording…' : 'Record'}
        </button>
        {error && <p className="text-red-700">{error}</p>}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">
          Settlements ({settlements.length})
        </h2>
        <ul>
          {settlements.map((settlement) => (
            <li key={settlement.id} className="flex justify-between border-b py-2">
              <span>
                {settlement.settledOn}
                {settlement.note && ` · ${settlement.note}`}
              </span>
              <Money value={new Decimal(settlement.amount)} />
            </li>
          ))}
          {settlements.length === 0 && (
            <li className="py-2 text-neutral-500">Nothing settled yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">
          Shares ({shares.length} items)
        </h2>
        <ul>
          {shares.map((share) => (
            <li key={share.itemId} className="flex items-center gap-2 border-b py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate">{share.description}</p>
                <Link
                  href={`/receipts/${share.receiptId}`}
                  className="text-xs text-neutral-500 underline"
                >
                  {share.merchant} · {share.purchasedOn}
                </Link>
              </div>
              <Money value={new Decimal(share.share)} className="text-sm" />
            </li>
          ))}
          {shares.length === 0 && (
            <li className="py-2 text-neutral-500">Nothing assigned to them yet.</li>
          )}
        </ul>
      </section>
    </main>
  )
}
