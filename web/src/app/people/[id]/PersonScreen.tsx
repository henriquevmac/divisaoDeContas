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
    <main className="flex flex-col gap-5 p-4 pb-28">
      <header>
        <h1 className="eyebrow">{name} owes</h1>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          <Money
            value={balanceValue}
            className={balanceValue.isNegative() ? 'text-good' : ''}
          />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Money value={new Decimal(shareTotal)} /> in shares less{' '}
          <Money value={new Decimal(settledTotal)} /> settled
          {balanceValue.isNegative() && ' — they are in credit'}
        </p>
      </header>

      <form
        onSubmit={settle}
        className="flex flex-col gap-2 rounded-xl border border-rule bg-card p-3.5"
      >
        <h2 className="eyebrow">Record a settlement</h2>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="min-h-12 w-28 rounded-lg border border-rule bg-paper p-2 text-right font-mono text-base tabular-nums focus:border-ink"
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            className="min-h-12 flex-1 rounded-lg border border-rule bg-paper p-2 text-base focus:border-ink"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
        >
          {pending ? 'Recording…' : 'Record'}
        </button>
        {error && <p className="text-sm text-accent">{error}</p>}
      </form>

      <section>
        <h2 className="mb-1 border-b border-ink pb-1 eyebrow">
          Settlements ({settlements.length})
        </h2>
        <ul>
          {settlements.map((settlement) => (
            <li
              key={settlement.id}
              className="flex items-center border-b border-rule py-2.5 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono tabular-nums">{settlement.settledOn}</span>
                {settlement.note && ` · ${settlement.note}`}
              </span>
              <span className="leader" aria-hidden="true" />
              <Money value={new Decimal(settlement.amount)} className="shrink-0" />
            </li>
          ))}
          {settlements.length === 0 && (
            <li className="py-2.5 text-sm text-muted">Nothing settled yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 border-b border-ink pb-1 eyebrow">
          Shares ({shares.length} items)
        </h2>
        <ul>
          {shares.map((share) => (
            <li
              key={share.itemId}
              className="flex items-center border-b border-rule py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate">{share.description}</p>
                <Link
                  href={`/receipts/${share.receiptId}`}
                  className="text-xs text-muted underline underline-offset-2"
                >
                  {share.merchant} ·{' '}
                  <span className="font-mono tabular-nums">{share.purchasedOn}</span>
                </Link>
              </div>
              <span className="leader" aria-hidden="true" />
              <Money value={new Decimal(share.share)} className="shrink-0 text-sm" />
            </li>
          ))}
          {shares.length === 0 && (
            <li className="py-2.5 text-sm text-muted">
              Nothing assigned to them yet.
            </li>
          )}
        </ul>
      </section>
    </main>
  )
}
