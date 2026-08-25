'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Decimal } from '@/domain/money'
import { Money } from '@/components/Money'
import { recordSettlementAction } from './actions'
import type { DebtWire, SettlementWire } from '@/lib/db/wire'
import type { PersonRow } from '@/lib/db/types'

export interface AssignedItemWire {
  itemId: string
  description: string
  receiptId: string
  merchant: string
  purchasedOn: string
  payerPersonId: string
  payerName: string
  share: string
}

interface Props {
  personId: string
  name: string
  debts: DebtWire[]
  /** Everyone except this person — the possible counterparties. */
  people: PersonRow[]
  items: AssignedItemWire[]
  settlements: SettlementWire[]
  nameOf: Record<string, string>
}

export function PersonScreen({
  personId,
  name,
  debts,
  people,
  items,
  settlements,
  nameOf,
}: Props) {
  const owes = debts.filter((debt) => !new Decimal(debt.net).isNegative())
  const owed = debts.filter((debt) => new Decimal(debt.net).isNegative())

  const [payTo, setPayTo] = useState(owes[0]?.counterpartyId ?? people[0]?.id ?? '')
  const [amount, setAmount] = useState(
    owes[0] ? new Decimal(owes[0].net).toDecimalPlaces(2).toString().replace('.', ',') : '',
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const itemsTotal = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.share)),
    new Decimal(0),
  )

  function settle(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await recordSettlementAction(
        personId,
        payTo,
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
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {items.length} item{items.length === 1 ? '' : 's'} worth{' '}
          <Money value={itemsTotal} /> across every receipt
        </p>
      </header>

      <section>
        <h2 className="mb-1 border-b border-ink pb-1 eyebrow">Owes</h2>
        {owes.length === 0 && (
          <p className="py-2.5 text-sm text-muted">Owes nobody anything.</p>
        )}
        <ul>
          {owes.map((debt) => (
            <DebtRow key={debt.counterpartyId} debt={debt} subject={name} />
          ))}
        </ul>
      </section>

      {owed.length > 0 && (
        <section>
          <h2 className="mb-1 border-b border-ink pb-1 eyebrow">Is owed</h2>
          <ul>
            {owed.map((debt) => (
              <DebtRow key={debt.counterpartyId} debt={debt} subject={name} />
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={settle} className="flex flex-col gap-2 rounded-xl border border-rule bg-card p-3.5">
        <h2 className="eyebrow">Record a settlement</h2>
        <p className="text-xs text-muted">{name} handed money to…</p>
        <select
          value={payTo}
          onChange={(event) => setPayTo(event.target.value)}
          aria-label="Paid to"
          className="min-h-12 rounded-lg border border-rule bg-paper p-2 text-base focus:border-ink"
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Amount"
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
          disabled={pending || !payTo}
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
          {settlements.map((settlement) => {
            const outgoing = settlement.personId === personId
            const other = outgoing ? settlement.paidToPersonId : settlement.personId
            return (
              <li
                key={settlement.id}
                className="flex items-center border-b border-rule py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {outgoing ? 'paid' : 'received from'}{' '}
                  {nameOf[other] ?? 'unknown'}
                  <span className="block font-mono text-xs text-muted">
                    {settlement.settledOn}
                    {settlement.note && ` · ${settlement.note}`}
                  </span>
                </span>
                <span className="leader" aria-hidden="true" />
                <Money
                  value={new Decimal(settlement.amount)}
                  className={`shrink-0 ${outgoing ? '' : 'text-good'}`}
                />
              </li>
            )
          })}
          {settlements.length === 0 && (
            <li className="py-2.5 text-sm text-muted">Nothing settled yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 border-b border-ink pb-1 eyebrow">
          Assigned items ({items.length})
        </h2>
        <ul>
          {items.map((item) => (
            <li
              key={item.itemId}
              className="flex items-center border-b border-rule py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate">{item.description}</p>
                <Link
                  href={`/receipts/${item.receiptId}`}
                  className="text-xs text-muted underline underline-offset-2"
                >
                  {item.merchant} ·{' '}
                  <span className="font-mono tabular-nums">{item.purchasedOn}</span>
                  {item.payerPersonId !== personId && ` · ${item.payerName} paid`}
                </Link>
              </div>
              <span className="leader" aria-hidden="true" />
              <Money value={new Decimal(item.share)} className="shrink-0 text-sm" />
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-2.5 text-sm text-muted">Nothing assigned to them yet.</li>
          )}
        </ul>
      </section>
    </main>
  )
}

/** Net figure as the headline, with both gross directions underneath. */
function DebtRow({ debt, subject }: { debt: DebtWire; subject: string }) {
  const [open, setOpen] = useState(false)
  const net = new Decimal(debt.net)
  const sharesOwed = new Decimal(debt.sharesOwed)
  const sharesLent = new Decimal(debt.sharesLent)
  const paid = new Decimal(debt.paid)
  const received = new Decimal(debt.received)

  return (
    <li className="border-b border-rule py-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center text-left"
      >
        <span className="min-w-0 truncate">{debt.counterpartyName}</span>
        <span className="leader" aria-hidden="true" />
        <Money
          value={net.abs()}
          className={`shrink-0 ${net.isNegative() ? 'text-good' : ''}`}
        />
        <span className="ml-2 shrink-0 text-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <dl className="mt-2 flex flex-col gap-1 border-l border-rule pl-3 text-xs text-muted">
          <Line
            label={`${subject}'s share of receipts ${debt.counterpartyName} paid`}
            value={sharesOwed}
          />
          <Line
            label={`${debt.counterpartyName}'s share of receipts ${subject} paid`}
            value={sharesLent}
            negative
          />
          {!paid.isZero() && (
            <Line label={`Already paid to ${debt.counterpartyName}`} value={paid} negative />
          )}
          {!received.isZero() && (
            <Line label={`Received from ${debt.counterpartyName}`} value={received} />
          )}
        </dl>
      )}
    </li>
  )
}

function Line({
  label,
  value,
  negative = false,
}: {
  label: string
  value: Decimal
  negative?: boolean
}) {
  return (
    <div className="flex items-center">
      <dt className="min-w-0">{label}</dt>
      <span className="leader" aria-hidden="true" />
      <dd className="shrink-0 font-mono tabular-nums">
        {negative ? '−' : '+'}
        <Money value={value} />
      </dd>
    </div>
  )
}
