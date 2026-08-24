'use client'

import { useState } from 'react'
import { Decimal } from '@/domain/money'
import { parseTranscription, TranscriptionParseError } from '@/domain/transcription/parse'
import { parseReceiptFilename } from '@/domain/transcription/filename'
import { draftItemsFromLines, nextItemKey, type DraftItem } from '@/domain/items'
import type { TranscriptionTotals } from '@/domain/transcription/types'
import { VerificationTable } from '@/components/VerificationTable'
import { Money } from '@/components/Money'
import { saveReceiptAction } from './actions'
import type { PersonRow } from '@/lib/db/types'

export function ImportScreen({ people }: { people: PersonRow[] }) {
  const [items, setItems] = useState<DraftItem[] | null>(null)
  const [totals, setTotals] = useState<TranscriptionTotals | null>(null)
  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [merchant, setMerchant] = useState('')
  const [store, setStore] = useState('')
  const [purchasedOn, setPurchasedOn] = useState('')
  const [payerId, setPayerId] = useState(
    people.find((person) => person.isOwner)?.id ?? people[0]?.id ?? '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    try {
      const parsed = parseTranscription(text)
      const metadata = parseReceiptFilename(file.name)

      setCsv(text)
      setFilename(file.name)
      setItems(draftItemsFromLines(parsed.lines))
      setTotals(parsed.totals)
      setMerchant(metadata.merchant)
      setStore(metadata.store)
      setPurchasedOn(metadata.purchasedOn || new Date().toISOString().slice(0, 10))
      setError('')
    } catch (caught) {
      setItems(null)
      setError(
        caught instanceof TranscriptionParseError
          ? caught.message
          : 'That file could not be read as a transcription.',
      )
    }
  }

  if (!items) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Import a receipt</h1>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
          className="rounded-lg border p-3"
        />
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      </main>
    )
  }

  const linesNet = items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0))
  const statedNet = totals?.net ?? null
  const difference = statedNet ? statedNet.minus(linesNet) : null
  const mismatch = difference !== null && !difference.isZero()

  async function save() {
    setSaving(true)
    try {
      await saveReceiptAction({
        merchant,
        store,
        purchasedOn,
        payerPersonId: payerId,
        sourceFilename: filename,
        sourceCsv: csv,
        statedGross: totals?.gross.toString() ?? null,
        statedDiscount: totals?.discount.toString() ?? null,
        statedNet: totals?.net.toString() ?? null,
        items: items!.map((item) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity.toString(),
          quantityKind: item.quantityKind,
          unitPrice: item.unitPrice.toString(),
          grossAmount: item.grossAmount.toString(),
          discount: item.discount.toString(),
          netAmount: item.netAmount.toString(),
        })),
      })
    } catch (caught) {
      setSaving(false)
      setError(caught instanceof Error ? caught.message : 'Could not save.')
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-40">
      <h1 className="text-xl font-semibold">Verify before saving</h1>

      <section className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm">
          Merchant
          <input
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Store
          <input
            value={store}
            onChange={(event) => setStore(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Date
          <input
            type="date"
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Paid by
          <select
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            className="rounded border p-2 text-base"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {mismatch && (
        <p className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900">
          These {items.length} lines sum to <Money value={linesNet} />, but the
          receipt says <Money value={statedNet!} /> — a difference of{' '}
          <Money value={difference!.abs()} />. Check for a dropped or misread
          line. You can still save.
        </p>
      )}

      {!mismatch && statedNet && (
        <p className="rounded-lg bg-green-50 p-3 text-green-900">
          Reconciled: {items.length} lines sum to <Money value={linesNet} />.
        </p>
      )}

      <VerificationTable items={items} onChange={setItems} />

      <button
        type="button"
        onClick={() =>
          setItems([
            ...items!,
            {
              key: nextItemKey(),
              category: '',
              description: 'New item',
              quantity: new Decimal(1),
              quantityKind: 'count',
              unitPrice: new Decimal(0),
              grossAmount: new Decimal(0),
              discount: new Decimal(0),
              netAmount: new Decimal(0),
            },
          ])
        }
        className="rounded-lg border border-dashed p-3 text-neutral-700"
      >
        Add a line
      </button>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}

      <div className="fixed inset-x-0 bottom-16 border-t bg-white p-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || items.length === 0 || !payerId}
          className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Save ${items.length} items`}
        </button>
      </div>
    </main>
  )
}
