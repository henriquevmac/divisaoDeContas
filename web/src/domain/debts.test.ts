import { describe, it, expect } from 'vitest'
import { parsePtDecimal } from './money'
import {
  netDebtsFor,
  balanceBetween,
  debtBreakdownFor,
  type ShareEntry,
  type SettlementEntry,
} from './debts'

const HENRIQUE = 'henrique'
const ANA = 'ana'
const BRUNO = 'bruno'

function share(personId: string, payerId: string, amount: string): ShareEntry {
  return { personId, payerId, amount: parsePtDecimal(amount) }
}

function settlement(
  fromPersonId: string,
  toPersonId: string,
  amount: string,
): SettlementEntry {
  return { fromPersonId, toPersonId, amount: parsePtDecimal(amount) }
}

describe('balanceBetween', () => {
  it('is what one owes the other for a receipt they paid', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    expect(balanceBetween(ANA, HENRIQUE, shares, []).toString()).toBe('30')
  })

  it('is negative when read from the other direction', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    expect(balanceBetween(HENRIQUE, ANA, shares, []).toString()).toBe('-30')
  })

  it('nets debts running in both directions', () => {
    // Ana owes 30 on a receipt Henrique paid; Henrique owes 20 on one Ana paid.
    const shares = [share(ANA, HENRIQUE, '30,00'), share(HENRIQUE, ANA, '20,00')]
    expect(balanceBetween(ANA, HENRIQUE, shares, []).toString()).toBe('10')
  })

  it('ignores a share on a receipt the person paid themselves', () => {
    const shares = [share(HENRIQUE, HENRIQUE, '70,00')]
    expect(balanceBetween(HENRIQUE, ANA, shares, []).toString()).toBe('0')
  })

  it('is reduced by a settlement in that direction', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    const settlements = [settlement(ANA, HENRIQUE, '10,00')]
    expect(balanceBetween(ANA, HENRIQUE, shares, settlements).toString()).toBe('20')
  })

  it('goes into credit when someone overpays', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    const settlements = [settlement(ANA, HENRIQUE, '50,00')]
    expect(balanceBetween(ANA, HENRIQUE, shares, settlements).toString()).toBe('-20')
  })

  it('ignores settlements involving a third person', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    const settlements = [settlement(ANA, BRUNO, '10,00')]
    expect(balanceBetween(ANA, HENRIQUE, shares, settlements).toString()).toBe('30')
  })
})

describe('netDebtsFor', () => {
  it('lists one entry per counterparty', () => {
    const shares = [share(ANA, HENRIQUE, '30,00'), share(ANA, BRUNO, '12,00')]
    const debts = netDebtsFor(ANA, shares, [])
    expect(debts.get(HENRIQUE)!.toString()).toBe('30')
    expect(debts.get(BRUNO)!.toString()).toBe('12')
  })

  it('omits a counterparty who is square', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    const settlements = [settlement(ANA, HENRIQUE, '30,00')]
    expect(netDebtsFor(ANA, shares, settlements).has(HENRIQUE)).toBe(false)
  })

  it('keeps a credit rather than hiding it', () => {
    const shares = [share(ANA, HENRIQUE, '30,00')]
    const settlements = [settlement(ANA, HENRIQUE, '40,00')]
    expect(netDebtsFor(ANA, shares, settlements).get(HENRIQUE)!.toString()).toBe('-10')
  })

  it('never lists the person against themselves', () => {
    const shares = [share(ANA, ANA, '30,00')]
    expect(netDebtsFor(ANA, shares, []).has(ANA)).toBe(false)
  })

  it('is empty when nothing is owed either way', () => {
    expect(netDebtsFor(ANA, [], []).size).toBe(0)
  })

  it('reads debts owed to the person as negatives', () => {
    const shares = [share(BRUNO, ANA, '25,00')]
    expect(netDebtsFor(ANA, shares, []).get(BRUNO)!.toString()).toBe('-25')
  })

  it('keeps an exact share rather than rounding to cents', () => {
    // ADR-0002 again: exact storage, rounding only at display.
    const shares = [
      { personId: ANA, payerId: HENRIQUE, amount: parsePtDecimal('10,00').dividedBy(3) },
    ]
    expect(
      netDebtsFor(ANA, shares, []).get(HENRIQUE)!.toDecimalPlaces(4).toString(),
    ).toBe('3.3333')
  })
})

describe('debtBreakdownFor', () => {
  it('keeps both directions visible behind the net figure', () => {
    const shares = [share(ANA, HENRIQUE, '30,00'), share(HENRIQUE, ANA, '20,00')]
    const breakdown = debtBreakdownFor(ANA, shares, []).get(HENRIQUE)!

    expect(breakdown.sharesOwed.toString()).toBe('30')
    expect(breakdown.sharesLent.toString()).toBe('20')
    expect(breakdown.net.toString()).toBe('10')
  })

  it('separates money paid from money received', () => {
    const shares = [share(ANA, HENRIQUE, '50,00')]
    const settlements = [
      settlement(ANA, HENRIQUE, '30,00'),
      settlement(HENRIQUE, ANA, '5,00'),
    ]
    const breakdown = debtBreakdownFor(ANA, shares, settlements).get(HENRIQUE)!

    expect(breakdown.paid.toString()).toBe('30')
    expect(breakdown.received.toString()).toBe('5')
    expect(breakdown.net.toString()).toBe('25')
  })

  it('accumulates many shares with the same counterparty', () => {
    const shares = [
      share(ANA, HENRIQUE, '10,00'),
      share(ANA, HENRIQUE, '5,50'),
      share(ANA, HENRIQUE, '4,50'),
    ]
    expect(debtBreakdownFor(ANA, shares, []).get(HENRIQUE)!.net.toString()).toBe('20')
  })

  it('reports a counterparty the person has only lent to', () => {
    const breakdown = debtBreakdownFor(HENRIQUE, [share(ANA, HENRIQUE, '30,00')], []).get(ANA)!
    expect(breakdown.sharesLent.toString()).toBe('30')
    expect(breakdown.sharesOwed.toString()).toBe('0')
    expect(breakdown.net.toString()).toBe('-30')
  })
})
