'use client'

import { useState, useTransition } from 'react'
import { Decimal } from '@/domain/money'
import { receiptTotals, unassignedItems, type AssignedItem } from '@/domain/shares'
import { ItemAssignmentList } from '@/components/ItemAssignmentList'
import { AssignSheet } from '@/components/AssignSheet'
import { Money } from '@/components/Money'
import { assignAction, explodeItemAction } from './actions'
import { itemFromWire, type ItemWire, type ReceiptWire } from '@/lib/db/wire'
import type { PersonRow } from '@/lib/db/types'

interface Props {
  receipt: ReceiptWire
  items: ItemWire[]
  people: PersonRow[]
}

export function ReceiptScreen({ receipt, items: wireItems, people }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Money arrives as strings across the Server → Client boundary.
  const items = wireItems.map(itemFromWire)

  const assigned: AssignedItem[] = items.map((item) => ({
    id: item.id,
    netAmount: item.netAmount,
    assigneeIds: item.assigneeIds,
  }))

  const totals = receiptTotals(assigned)
  const outstanding = unassignedItems(assigned).length
  const net = items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0))
  const nameOf = new Map(people.map((person) => [person.id, person.name]))

  function assign(personIds: string[], mode: 'replace' | 'add') {
    const itemIds = [...selected]
    setSheetOpen(false)
    startTransition(async () => {
      await assignAction(receipt.id, itemIds, personIds, mode)
      setSelected(new Set())
    })
  }

  return (
    <main className="flex flex-col gap-5 p-4 pb-44">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {receipt.merchant || 'Untitled'}
          {receipt.store && <span className="text-muted"> · {receipt.store}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">
          <span className="font-mono tabular-nums">{receipt.purchasedOn}</span> ·{' '}
          {items.length} items · <Money value={net} /> · paid by{' '}
          {nameOf.get(receipt.payerPersonId) ?? 'unknown'}
        </p>
      </header>

      {outstanding > 0 ? (
        <p className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-accent">
          {outstanding} item{outstanding === 1 ? '' : 's'} still unassigned. This
          receipt is not complete.
        </p>
      ) : (
        <p className="rounded-xl bg-good-soft p-3 text-sm text-good">
          Complete — every item has someone assigned.
        </p>
      )}

      <section className="rounded-xl border border-rule bg-card p-3.5">
        <h2 className="mb-1 border-b border-ink pb-1 eyebrow">Totals</h2>
        <ul>
          {[...totals.entries()].map(([personId, total]) => (
            <li key={personId} className="flex items-center py-1.5">
              <span className="min-w-0 truncate">
                {nameOf.get(personId) ?? 'unknown'}
              </span>
              <span className="leader" aria-hidden="true" />
              <Money value={total} className="shrink-0" />
            </li>
          ))}
          {totals.size === 0 && (
            <li className="py-1.5 text-sm text-muted">Nothing assigned yet.</li>
          )}
        </ul>
      </section>

      <ItemAssignmentList
        items={items}
        people={people}
        selected={selected}
        onSelectedChange={setSelected}
        onExplode={(itemId) =>
          startTransition(async () => {
            await explodeItemAction(receipt.id, itemId)
          })
        }
      />

      <div className="fixed inset-x-0 bottom-[3.75rem] z-10 border-t border-rule bg-card">
        <div className="mx-auto flex max-w-md gap-2 p-3">
          <button
            type="button"
            onClick={() =>
              setSelected(
                selected.size === items.length
                  ? new Set()
                  : new Set(items.map((item) => item.id)),
              )
            }
            className="min-h-12 rounded-xl border border-rule px-4 text-ink"
          >
            {selected.size === items.length ? 'None' : 'All'}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => setSheetOpen(true)}
            className="min-h-12 flex-1 rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
          >
            {pending ? 'Saving…' : `Assign ${selected.size} selected`}
          </button>
        </div>
      </div>

      {sheetOpen && (
        <AssignSheet
          people={people}
          count={selected.size}
          onAssign={assign}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  )
}
