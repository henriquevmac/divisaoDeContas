'use client'

import Link from 'next/link'
import { Decimal, formatEuro } from '@/domain/money'
import type { Slice } from '@/domain/stats'
import { Money } from '@/components/Money'
import { SpendPie } from '@/components/SpendPie'
import { colourFor } from '@/components/series-palette'

export interface SliceWire {
  id: string
  label: string
  amount: string
  fraction: number
  foldedCount: number
}

interface Props {
  slices: SliceWire[]
  total: string
  unassigned: string
  receiptCount: number
  itemCount: number
}

export function StatsScreen({
  slices: wireSlices,
  total,
  unassigned,
  receiptCount,
  itemCount,
}: Props) {
  const slices: Slice[] = wireSlices.map((slice) => ({
    ...slice,
    amount: new Decimal(slice.amount),
  }))
  const totalValue = new Decimal(total)
  const unassignedValue = new Decimal(unassigned)

  return (
    <main className="flex flex-col gap-5 p-4 pb-28">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-0.5 text-sm text-muted">
          {receiptCount} receipt{receiptCount === 1 ? '' : 's'} · {itemCount} items
        </p>
      </header>

      <section className="rounded-xl border border-rule bg-card p-4">
        <h2 className="eyebrow">Assigned in total</h2>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          <Money value={totalValue} />
        </p>

        {slices.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-rule p-6 text-center text-sm text-muted">
            Nothing assigned yet. Assign items on a receipt and the split shows
            up here.
          </p>
        ) : (
          <div className="mt-4">
            <SpendPie slices={slices} total={totalValue} />
          </div>
        )}
      </section>

      {slices.length > 0 && (
        <section>
          <h2 className="mb-1 border-b border-ink pb-1 eyebrow">Who spent what</h2>
          {/*
            The table view. It is not decoration: the light-mode palette warns on
            contrast for three hues, so exact figures must be legible without
            relying on the swatch, and identity is never colour alone.
          */}
          <table className="w-full text-sm">
            <caption className="sr-only">
              Total spend by person, largest first
            </caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 text-left font-normal">
                  <span className="eyebrow">Person</span>
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  <span className="eyebrow">Share</span>
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  <span className="eyebrow">Total</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, index) => (
                <tr key={slice.id} className="border-t border-rule">
                  <th scope="row" className="py-2.5 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-sm"
                        style={{ background: colourFor(slice, index) }}
                      />
                      {slice.id === 'other' ? (
                        <span className="truncate">
                          Other
                          <span className="text-muted">
                            {' '}
                            ({slice.foldedCount} people)
                          </span>
                        </span>
                      ) : (
                        <Link
                          href={`/people/${slice.id}`}
                          className="truncate underline underline-offset-2"
                        >
                          {slice.label}
                        </Link>
                      )}
                    </span>
                  </th>
                  <td className="py-2.5 text-right font-mono tabular-nums text-muted">
                    {Math.round(slice.fraction * 100)}%
                  </td>
                  <td className="py-2.5 text-right">
                    <Money value={slice.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink">
                <th scope="row" className="py-2.5 text-left font-medium">
                  Total
                </th>
                <td />
                <td className="py-2.5 text-right font-medium">
                  <Money value={totalValue} />
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {unassignedValue.greaterThan(0) && (
        <p className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-accent">
          {formatEuro(unassignedValue)} sits on items nobody is assigned to, so
          it is missing from the figures above.
        </p>
      )}
    </main>
  )
}
