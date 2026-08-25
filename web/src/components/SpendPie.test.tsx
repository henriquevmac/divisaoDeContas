import { describe, it, expect } from 'vitest'
import { Decimal } from '@/domain/money'
import { colourFor, MAX_SERIES } from './SpendPie'
import { toSlices } from '@/domain/stats'
import type { Slice } from '@/domain/stats'

function slice(id: string): Slice {
  return { id, label: id, amount: new Decimal(1), fraction: 0.1, foldedCount: 1 }
}

describe('colourFor', () => {
  it('gives every slot a distinct hue', () => {
    const colours = Array.from({ length: MAX_SERIES }, (_, i) =>
      colourFor(slice(`p${i}`), i),
    )
    expect(new Set(colours).size).toBe(MAX_SERIES)
  })

  it('assigns hues in fixed order, not by rank changing between renders', () => {
    expect(colourFor(slice('ana'), 0)).toBe(colourFor(slice('bruno'), 0))
  })

  it('paints Other in the reserved neutral, not a series hue', () => {
    const other = colourFor({ ...slice('other'), id: 'other' }, 3)
    expect(other).toBe('var(--series-other)')
    expect(other).not.toContain('--series-4')
  })
})

describe('the slice cap and the palette agree', () => {
  it('never asks for more hues than the palette has', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      label: `P${i}`,
      amount: new Decimal(20 - i),
    }))
    const slices = toSlices(many, MAX_SERIES)

    expect(slices).toHaveLength(MAX_SERIES)
    expect(slices.filter((s) => s.id !== 'other')).toHaveLength(MAX_SERIES - 1)
  })

  it('shows eight people without folding anyone into Other', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      label: `P${i}`,
      amount: new Decimal(8 - i),
    }))
    expect(toSlices(eight, MAX_SERIES).some((s) => s.id === 'other')).toBe(false)
  })
})
