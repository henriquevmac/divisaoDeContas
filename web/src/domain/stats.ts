import { Decimal } from './money'
import type { ShareEntry } from './debts'

/** What each Person consumed in total, regardless of who paid for it. */
export function spendByPerson(shares: ShareEntry[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>()
  for (const entry of shares) {
    totals.set(
      entry.personId,
      (totals.get(entry.personId) ?? new Decimal(0)).plus(entry.amount),
    )
  }
  return totals
}

export interface SliceInput {
  id: string
  label: string
  amount: Decimal
}

export interface Slice extends SliceInput {
  /** Share of the whole, 0–1. A ratio for geometry, so a float is fine here. */
  fraction: number
  /** How many entries were folded into this slice, for "Other". */
  foldedCount: number
}

/**
 * Largest first, with the tail folded into a single "Other". A pie is only
 * readable at a glance with a handful of segments, and a categorical palette
 * has a fixed number of hues — a ninth slice is never a generated colour.
 */
export function toSlices(entries: SliceInput[], maxSlices: number): Slice[] {
  // A bad cap used to fail silently by folding everyone into "Other", which
  // reads as a real chart. Refuse it instead.
  if (!Number.isInteger(maxSlices) || maxSlices < 2) {
    throw new Error(`toSlices needs a whole cap of 2 or more, got ${maxSlices}`)
  }

  const spending = entries.filter((entry) => entry.amount.greaterThan(0))
  if (spending.length === 0) return []

  const total = spending.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
  const ranked = [...spending].sort((a, b) => b.amount.comparedTo(a.amount))

  const fits = ranked.length <= maxSlices
  const kept = fits ? ranked : ranked.slice(0, maxSlices - 1)
  const folded = fits ? [] : ranked.slice(maxSlices - 1)

  const slices: Slice[] = kept.map((entry) => ({
    ...entry,
    fraction: entry.amount.dividedBy(total).toNumber(),
    foldedCount: 1,
  }))

  if (folded.length > 0) {
    const amount = folded.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
    slices.push({
      id: 'other',
      label: 'Other',
      amount,
      fraction: amount.dividedBy(total).toNumber(),
      foldedCount: folded.length,
    })
  }

  return slices
}
