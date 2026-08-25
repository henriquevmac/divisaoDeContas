import { describe, it, expect } from 'vitest'
import { parsePtDecimal } from '@/domain/money'
import { itemToWire, itemFromWire, receiptToWire, settlementToWire } from './wire'
import type { ItemRow, ReceiptRow, SettlementRow } from './types'

const item: ItemRow = {
  id: 'i1',
  key: 'i1',
  position: 0,
  category: 'BEBIDAS',
  description: 'CERVEJA LOIRA 30X25CL',
  quantity: parsePtDecimal('3'),
  quantityKind: 'count',
  unitPrice: parsePtDecimal('14,95'),
  grossAmount: parsePtDecimal('44,85'),
  discount: parsePtDecimal('0,00'),
  netAmount: parsePtDecimal('44,85'),
  assigneeIds: ['ana'],
}

/**
 * Next.js rejects any prop that is not a plain serialisable value, which is how
 * passing Decimal into a Client Component failed at runtime. Structured cloning
 * is the same check, so it catches a regression without needing a browser.
 */
function isPlain(value: unknown): boolean {
  try {
    structuredClone(value)
    return true
  } catch {
    return false
  }
}

describe('wire serialisation', () => {
  it('rejects a raw row, proving the test detects the original bug', () => {
    expect(isPlain(item)).toBe(false)
  })

  it('produces a plain object for an item', () => {
    expect(isPlain(itemToWire(item))).toBe(true)
  })

  it('produces a plain object for a receipt', () => {
    const receipt: ReceiptRow = {
      id: 'r1',
      merchant: 'Super Bairro',
      store: 'Centro',
      purchasedOn: '2026-08-24',
      payerPersonId: 'owner',
      statedNet: parsePtDecimal('191,22'),
    }
    expect(isPlain(receiptToWire(receipt))).toBe(true)
  })

  it('produces a plain object for a settlement', () => {
    const settlement: SettlementRow = {
      id: 's1',
      personId: 'ana',
      paidToPersonId: 'henrique',
      amount: parsePtDecimal('23,40'),
      settledOn: '2026-08-24',
      note: '',
    }
    expect(isPlain(settlementToWire(settlement))).toBe(true)
  })

  it('round-trips an item without losing precision', () => {
    const third = { ...item, netAmount: parsePtDecimal('10,00').dividedBy(3) }
    const back = itemFromWire(itemToWire(third))
    expect(back.netAmount.equals(third.netAmount)).toBe(true)
  })

  it('keeps a null stated net as null', () => {
    const receipt: ReceiptRow = {
      id: 'r1',
      merchant: '',
      store: '',
      purchasedOn: '2026-08-24',
      payerPersonId: 'owner',
      statedNet: null,
    }
    expect(receiptToWire(receipt).statedNet).toBeNull()
  })
})
