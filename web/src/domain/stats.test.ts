import { describe, it, expect } from 'vitest'
import { parsePtDecimal, Decimal } from './money'
import { spendByPerson, toSlices } from './stats'
import type { ShareEntry } from './debts'

function share(personId: string, amount: string): ShareEntry {
  return { personId, payerId: 'whoever', amount: parsePtDecimal(amount) }
}

describe('spendByPerson', () => {
  it('sums every share a person is on', () => {
    const totals = spendByPerson([share('ana', '10,00'), share('ana', '5,50')])
    expect(totals.get('ana')!.toString()).toBe('15.5')
  })

  it('keeps people apart', () => {
    const totals = spendByPerson([share('ana', '10,00'), share('bruno', '4,00')])
    expect(totals.get('bruno')!.toString()).toBe('4')
  })

  it('counts a share regardless of who paid', () => {
    const totals = spendByPerson([
      { personId: 'ana', payerId: 'ana', amount: parsePtDecimal('8,00') },
    ])
    expect(totals.get('ana')!.toString()).toBe('8')
  })

  it('is empty for no shares', () => {
    expect(spendByPerson([]).size).toBe(0)
  })
})

describe('toSlices', () => {
  const entries = [
    { id: 'ana', label: 'Ana', amount: parsePtDecimal('50,00') },
    { id: 'bruno', label: 'Bruno', amount: parsePtDecimal('30,00') },
    { id: 'carla', label: 'Carla', amount: parsePtDecimal('20,00') },
  ]

  it('orders slices largest first', () => {
    expect(toSlices(entries, 6).map((slice) => slice.id)).toEqual([
      'ana',
      'bruno',
      'carla',
    ])
  })

  it('gives each slice its fraction of the whole', () => {
    const slices = toSlices(entries, 6)
    expect(slices[0].fraction).toBeCloseTo(0.5)
    expect(slices[2].fraction).toBeCloseTo(0.2)
  })

  it('fractions sum to one', () => {
    const total = toSlices(entries, 6).reduce((sum, slice) => sum + slice.fraction, 0)
    expect(total).toBeCloseTo(1)
  })

  it('folds the tail into Other rather than inventing colours', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: `p${index}`,
      label: `Person ${index}`,
      amount: new Decimal(9 - index),
    }))
    const slices = toSlices(many, 6)

    expect(slices).toHaveLength(6)
    expect(slices[5].id).toBe('other')
    expect(slices[5].label).toBe('Other')
    // 4 + 3 + 2 + 1 from the four smallest.
    expect(slices[5].amount.toString()).toBe('10')
  })

  it('says how many were folded together', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: `p${index}`,
      label: `Person ${index}`,
      amount: new Decimal(9 - index),
    }))
    expect(toSlices(many, 6)[5].foldedCount).toBe(4)
  })

  it('does not fold when everyone fits', () => {
    expect(toSlices(entries, 6).some((slice) => slice.id === 'other')).toBe(false)
  })

  it('drops people who spent nothing', () => {
    const withZero = [...entries, { id: 'dan', label: 'Dan', amount: new Decimal(0) }]
    expect(toSlices(withZero, 6).some((slice) => slice.id === 'dan')).toBe(false)
  })

  it('refuses an undefined cap rather than folding everyone into Other', () => {
    // How the pie broke: MAX_SERIES came from a 'use client' module and
    // arrived as a proxy, so the cap was undefined and every person folded.
    expect(() =>
      toSlices(entries, undefined as unknown as number),
    ).toThrow(/whole cap/)
  })

  it('refuses a cap below two', () => {
    expect(() => toSlices(entries, 1)).toThrow(/whole cap/)
  })

  it('is empty when nothing was spent', () => {
    expect(toSlices([], 6)).toEqual([])
  })

  it('gives a single person the whole circle', () => {
    const slices = toSlices([entries[0]], 6)
    expect(slices[0].fraction).toBe(1)
  })
})
