import { Decimal, isWholeNumber } from './money'
import type { QuantityKind, TranscriptionLine } from './transcription/types'

export interface DraftItem {
  /** Stable client-side identity for React keys and selection. Not a DB id. */
  key: string
  category: string
  description: string
  quantity: Decimal
  quantityKind: QuantityKind
  unitPrice: Decimal
  grossAmount: Decimal
  discount: Decimal
  netAmount: Decimal
}

let keyCounter = 0

export function nextItemKey(): string {
  keyCounter += 1
  return `item-${keyCounter}`
}

export function draftItemsFromLines(lines: TranscriptionLine[]): DraftItem[] {
  return lines.map((line) => ({
    key: nextItemKey(),
    category: line.category,
    description: line.description,
    quantity: line.quantity,
    quantityKind: line.quantityKind,
    unitPrice: line.unitPrice,
    grossAmount: line.grossAmount,
    discount: line.discount,
    netAmount: line.netAmount,
  }))
}

export function canExplode(item: DraftItem): boolean {
  return (
    item.quantityKind === 'count' &&
    isWholeNumber(item.quantity) &&
    item.quantity.greaterThan(1)
  )
}

/**
 * Replaces one item of quantity N with N items of quantity one, dividing every
 * amount by N. Amounts stay exact decimals; rounding happens only at display
 * (ADR-0002).
 */
export function explode(item: DraftItem): DraftItem[] {
  if (!canExplode(item)) return [item]

  const units = item.quantity.toNumber()
  return Array.from({ length: units }, () => ({
    ...item,
    key: nextItemKey(),
    quantity: new Decimal(1),
    grossAmount: item.grossAmount.dividedBy(units),
    discount: item.discount.dividedBy(units),
    netAmount: item.netAmount.dividedBy(units),
  }))
}
