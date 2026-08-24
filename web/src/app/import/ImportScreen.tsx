'use client'

import { useState } from 'react'
import { Decimal } from '@/domain/money'
import { parseTranscription, TranscriptionParseError } from '@/domain/transcription/parse'
import { parseReceiptFilename } from '@/domain/transcription/filename'
import { draftItemsFromLines, nextItemKey, type DraftItem } from '@/domain/items'
import type { TranscriptionTotals } from '@/domain/transcription/types'
import { TranscriptionGuide } from '@/components/TranscriptionGuide'
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
      <main className="flex flex-col gap-5 p-4 pb-28">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Import a receipt</h1>
          <p className="mt-1 text-sm text-muted">
            Upload the CSV you got from Claude. Nothing is saved until you have
            checked it.
          </p>
        </header>

        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-rule bg-card p-6 text-center">
          <span className="font-medium">Choose a CSV file</span>
          <span className="eyebrow">merchant_store_DD-MM-YYYY.csv</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
            }}
            className="sr-only"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>
        )}

        <TranscriptionGuide />
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
    <main className="flex flex-col gap-5 p-4 pb-44">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verify before saving</h1>
        <p className="mt-1 text-sm text-muted">
          The transcription can be wrong. Fix anything that looks off.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Merchant</span>
          <input
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            className="min-h-12 rounded-lg border border-rule bg-card p-2 text-base focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Store</span>
          <input
            value={store}
            onChange={(event) => setStore(event.target.value)}
            className="min-h-12 rounded-lg border border-rule bg-card p-2 text-base focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Date</span>
          <input
            type="date"
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
            className="min-h-12 rounded-lg border border-rule bg-card p-2 font-mono text-base focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Paid by</span>
          <select
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            className="min-h-12 rounded-lg border border-rule bg-card p-2 text-base focus:border-ink"
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
        <p className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-accent">
          These {items.length} lines sum to <Money value={linesNet} />, but the
          receipt says <Money value={statedNet!} /> — a difference of{' '}
          <Money value={difference!.abs()} />. Check for a dropped or misread
          line. You can still save.
        </p>
      )}

      {!mismatch && statedNet && (
        <p className="rounded-xl bg-good-soft p-3 text-sm text-good">
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
        className="min-h-12 rounded-xl border border-dashed border-rule text-muted"
      >
        Add a line
      </button>

      {error && (
        <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>
      )}

      <div className="fixed inset-x-0 bottom-[3.75rem] z-10 border-t border-rule bg-card">
        <div className="mx-auto max-w-md p-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || items.length === 0 || !payerId}
          className="min-h-12 w-full rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
        >
          {saving ? 'Saving…' : `Save ${items.length} items`}
        </button>
        </div>
      </div>
    </main>
  )
}
