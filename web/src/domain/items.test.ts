import { describe, it, expect } from 'vitest'
import { parsePtDecimal } from './money'
import { canExplode, explode, draftItemsFromLines, type DraftItem } from './items'
import type { TranscriptionLine } from './transcription/types'

function item(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    key: 'k1',
    category: 'BEBIDAS',
    description: 'CERVEJA LOIRA 30X25CL',
    quantity: parsePtDecimal('3'),
    quantityKind: 'count',
    unitPrice: parsePtDecimal('14,95'),
    grossAmount: parsePtDecimal('44,85'),
    discount: parsePtDecimal('0,00'),
    netAmount: parsePtDecimal('44,85'),
    ...overrides,
  }
}

describe('canExplode', () => {
  it('allows a count greater than one', () => {
    expect(canExplode(item())).toBe(true)
  })

  it('refuses a quantity of one', () => {
    expect(canExplode(item({ quantity: parsePtDecimal('1') }))).toBe(false)
  })

  it('refuses a weight', () => {
    expect(
      canExplode(
        item({ quantity: parsePtDecimal('1,532'), quantityKind: 'weight' }),
      ),
    ).toBe(false)
  })
})

describe('explode', () => {
  it('produces one item per unit', () => {
    expect(explode(item())).toHaveLength(3)
  })

  it('divides gross, discount and net evenly', () => {
    const parts = explode(
      item({
        description: 'WRAPS TRIGO 6UN',
        quantity: parsePtDecimal('3'),
        unitPrice: parsePtDecimal('2,49'),
        grossAmount: parsePtDecimal('7,47'),
        discount: parsePtDecimal('1,50'),
        netAmount: parsePtDecimal('5,97'),
      }),
    )
    expect(parts.map((part) => part.netAmount.toString())).toEqual([
      '1.99',
      '1.99',
      '1.99',
    ])
    expect(parts[0].grossAmount.toString()).toBe('2.49')
    expect(parts[0].discount.toString()).toBe('0.5')
  })

  it('sets every part to quantity one and keeps the unit price', () => {
    const parts = explode(item())
    expect(parts.every((part) => part.quantity.equals(1))).toBe(true)
    expect(parts[0].unitPrice.toString()).toBe('14.95')
  })

  it('gives every part a distinct key', () => {
    const keys = explode(item()).map((part) => part.key)
    expect(new Set(keys).size).toBe(3)
  })

  it('carries category and description through unchanged', () => {
    const parts = explode(item())
    expect(parts[0].category).toBe('BEBIDAS')
    expect(parts[0].description).toBe('CERVEJA LOIRA 30X25CL')
  })

  it('returns the item untouched when it cannot be exploded', () => {
    const single = item({ quantity: parsePtDecimal('1') })
    expect(explode(single)).toEqual([single])
  })
})

describe('draftItemsFromLines', () => {
  it('gives duplicate lines distinct keys', () => {
    const line: Omit<TranscriptionLine, 'position'> = {
      category: 'TALHO',
      description: 'BOVINO HAMBURG 120G',
      quantity: parsePtDecimal('6'),
      quantityKind: 'count',
      unitPrice: parsePtDecimal('1,38'),
      grossAmount: parsePtDecimal('8,28'),
      discount: parsePtDecimal('0,00'),
      netAmount: parsePtDecimal('8,28'),
    }
    const items = draftItemsFromLines([
      { ...line, position: 0 },
      { ...line, position: 1 },
    ])
    expect(items).toHaveLength(2)
    expect(items[0].key).not.toBe(items[1].key)
  })
})
