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
    <main className="flex flex-col gap-4 p-4 pb-40">
      <header>
        <h1 className="text-xl font-semibold">
          {receipt.merchant} {receipt.store && `· ${receipt.store}`}
        </h1>
        <p className="text-sm text-neutral-600">
          {receipt.purchasedOn} · {items.length} items · <Money value={net} /> ·
          paid by {nameOf.get(receipt.payerPersonId) ?? 'unknown'}
        </p>
      </header>

      {outstanding > 0 ? (
        <p className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900">
          {outstanding} item{outstanding === 1 ? '' : 's'} still unassigned. This
          receipt is not complete.
        </p>
      ) : (
        <p className="rounded-lg bg-green-50 p-3 text-green-900">
          Complete — every item has someone assigned.
        </p>
      )}

      <section className="rounded-lg border p-3">
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">Totals</h2>
        <ul>
          {[...totals.entries()].map(([personId, total]) => (
            <li key={personId} className="flex justify-between py-1">
              <span>{nameOf.get(personId) ?? 'unknown'}</span>
              <Money value={total} />
            </li>
          ))}
          {totals.size === 0 && (
            <li className="text-neutral-500">Nothing assigned yet.</li>
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

      <div className="fixed inset-x-0 bottom-16 flex gap-2 border-t bg-white p-4">
        <button
          type="button"
          onClick={() => setSelected(new Set(items.map((item) => item.id)))}
          className="rounded-lg border px-4 py-3"
        >
          All
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          onClick={() => setSheetOpen(true)}
          className="flex-1 rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : `Assign ${selected.size} selected`}
        </button>
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
