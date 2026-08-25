import { Decimal } from './money'

/**
 * One person's share of one item, tagged with who actually paid that receipt.
 * A share only creates a debt when those two people differ.
 */
export interface ShareEntry {
  personId: string
  payerId: string
  amount: Decimal
}

/** Money handed from one person to another. */
export interface SettlementEntry {
  fromPersonId: string
  toPersonId: string
  amount: Decimal
}

/**
 * A debt seen from one person's side. `net` is the single figure that settles
 * the pair; the other four explain where it came from, because "you owe Ana
 * €10" is hard to trust without seeing the two directions behind it.
 */
export interface DebtBreakdown {
  /** Shares this person ran up on receipts the counterparty paid. */
  sharesOwed: Decimal
  /** Shares the counterparty ran up on receipts this person paid. */
  sharesLent: Decimal
  /** Settlements this person handed the counterparty. */
  paid: Decimal
  /** Settlements the counterparty handed this person. */
  received: Decimal
  /**
   * What this person still owes the counterparty for their own consumption,
   * after what they have already handed over. Not cancelled against the other
   * direction.
   */
  outstandingOwed: Decimal
  /** The mirror: what the counterparty still owes this person. */
  outstandingLent: Decimal
  /** Positive: this person owes. Negative: they are owed. */
  net: Decimal
}

const ZERO = new Decimal(0)

function emptyBreakdown(): DebtBreakdown {
  return {
    sharesOwed: ZERO,
    sharesLent: ZERO,
    paid: ZERO,
    received: ZERO,
    outstandingOwed: ZERO,
    outstandingLent: ZERO,
    net: ZERO,
  }
}

function withNet(breakdown: DebtBreakdown): DebtBreakdown {
  const outstandingOwed = breakdown.sharesOwed.minus(breakdown.paid)
  const outstandingLent = breakdown.sharesLent.minus(breakdown.received)

  return {
    ...breakdown,
    outstandingOwed,
    outstandingLent,
    net: outstandingOwed.minus(outstandingLent),
  }
}

/**
 * Every counterparty this person has a position with, netted to one figure
 * each. Counterparties who are square are omitted; credits are kept.
 */
export function debtBreakdownFor(
  personId: string,
  shares: ShareEntry[],
  settlements: SettlementEntry[],
): Map<string, DebtBreakdown> {
  const byCounterparty = new Map<string, DebtBreakdown>()

  function edit(counterpartyId: string, change: Partial<DebtBreakdown>) {
    if (counterpartyId === personId) return
    const current = byCounterparty.get(counterpartyId) ?? emptyBreakdown()
    byCounterparty.set(counterpartyId, { ...current, ...change })
  }

  for (const entry of shares) {
    if (entry.personId === entry.payerId) continue

    if (entry.personId === personId) {
      const current = byCounterparty.get(entry.payerId) ?? emptyBreakdown()
      edit(entry.payerId, { sharesOwed: current.sharesOwed.plus(entry.amount) })
    } else if (entry.payerId === personId) {
      const current = byCounterparty.get(entry.personId) ?? emptyBreakdown()
      edit(entry.personId, { sharesLent: current.sharesLent.plus(entry.amount) })
    }
  }

  for (const entry of settlements) {
    if (entry.fromPersonId === personId) {
      const current = byCounterparty.get(entry.toPersonId) ?? emptyBreakdown()
      edit(entry.toPersonId, { paid: current.paid.plus(entry.amount) })
    } else if (entry.toPersonId === personId) {
      const current = byCounterparty.get(entry.fromPersonId) ?? emptyBreakdown()
      edit(entry.fromPersonId, { received: current.received.plus(entry.amount) })
    }
  }

  const result = new Map<string, DebtBreakdown>()
  for (const [counterpartyId, breakdown] of byCounterparty) {
    const settled = withNet(breakdown)
    if (!settled.net.isZero()) result.set(counterpartyId, settled)
  }
  return result
}

/** Just the net figures, keyed by counterparty. */
export function netDebtsFor(
  personId: string,
  shares: ShareEntry[],
  settlements: SettlementEntry[],
): Map<string, Decimal> {
  const nets = new Map<string, Decimal>()
  for (const [counterpartyId, breakdown] of debtBreakdownFor(
    personId,
    shares,
    settlements,
  )) {
    nets.set(counterpartyId, breakdown.net)
  }
  return nets
}

/** What `personId` owes `counterpartyId`. Negative means they are owed. */
export function balanceBetween(
  personId: string,
  counterpartyId: string,
  shares: ShareEntry[],
  settlements: SettlementEntry[],
): Decimal {
  const breakdown = debtBreakdownFor(personId, shares, settlements).get(
    counterpartyId,
  )
  return breakdown?.net ?? ZERO
}
