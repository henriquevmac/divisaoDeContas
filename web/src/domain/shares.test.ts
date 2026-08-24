import { describe, it, expect } from 'vitest'
import { parsePtDecimal, Decimal } from './money'
import {
  shareFor,
  receiptTotals,
  unassignedItems,
  isComplete,
  balanceFor,
  type AssignedItem,
} from './shares'

const wine: AssignedItem = {
  id: 'wine',
  netAmount: parsePtDecimal('18,00'),
  assigneeIds: ['ana', 'bruno', 'owner'],
}

describe('shareFor', () => {
  it('divides equally among assignees', () => {
    expect(shareFor(wine, 'ana').toString()).toBe('6')
  })

  it('is zero for someone not assigned', () => {
    expect(shareFor(wine, 'carla').toString()).toBe('0')
  })

  it('is zero when nobody is assigned', () => {
    const orphan: AssignedItem = {
      id: 'orphan',
      netAmount: parsePtDecimal('5,00'),
      assigneeIds: [],
    }
    expect(shareFor(orphan, 'ana').toString()).toBe('0')
  })

  it('keeps a repeating share exact rather than rounding to cents', () => {
    const tenner: AssignedItem = {
      id: 'tenner',
      netAmount: parsePtDecimal('10,00'),
      assigneeIds: ['ana', 'bruno', 'owner'],
    }
    // ADR-0002: exact storage, rounding only at display. Do not "fix" this.
    expect(shareFor(tenner, 'ana').toDecimalPlaces(4).toString()).toBe('3.3333')
  })
})

describe('receiptTotals', () => {
  it('sums each person across items', () => {
    const beer: AssignedItem = {
      id: 'beer',
      netAmount: parsePtDecimal('44,85'),
      assigneeIds: ['ana', 'bruno'],
    }
    const totals = receiptTotals([wine, beer])
    expect(totals.get('ana')!.toString()).toBe('28.425')
    expect(totals.get('bruno')!.toString()).toBe('28.425')
    expect(totals.get('owner')!.toString()).toBe('6')
  })

  it('omits people with no assignments', () => {
    expect(receiptTotals([wine]).has('carla')).toBe(false)
  })

  it('returns an empty map for no items', () => {
    expect(receiptTotals([]).size).toBe(0)
  })
})

describe('completeness', () => {
  const orphan: AssignedItem = {
    id: 'orphan',
    netAmount: parsePtDecimal('5,00'),
    assigneeIds: [],
  }

  it('lists items with no assignees', () => {
    expect(unassignedItems([wine, orphan]).map((i) => i.id)).toEqual(['orphan'])
  })

  it('is incomplete when any item is unassigned', () => {
    expect(isComplete([wine, orphan])).toBe(false)
  })

  it('is complete when every item has an assignee', () => {
    expect(isComplete([wine])).toBe(true)
  })

  it('treats an empty receipt as complete', () => {
    expect(isComplete([])).toBe(true)
  })
})

describe('balanceFor', () => {
  it('is what is owed after settlements', () => {
    expect(
      balanceFor(parsePtDecimal('23,40'), parsePtDecimal('10,00')).toString(),
    ).toBe('13.4')
  })

  it('goes negative when a person has overpaid', () => {
    expect(
      balanceFor(parsePtDecimal('17,40'), parsePtDecimal('23,40')).toString(),
    ).toBe('-6')
  })

  it('is zero when settled exactly', () => {
    expect(balanceFor(new Decimal(5), new Decimal(5)).isZero()).toBe(true)
  })
})
