import { Decimal } from './money'

export interface AssignedItem {
  id: string
  netAmount: Decimal
  assigneeIds: string[]
}

/**
 * A person's portion of an item: its net amount divided equally among its
 * assignees. Everyone assigned bears an identical share regardless of how much
 * they consumed. Kept exact; rounded only for display (ADR-0002).
 */
export function shareFor(item: AssignedItem, personId: string): Decimal {
  if (!item.assigneeIds.includes(personId)) return new Decimal(0)
  return item.netAmount.dividedBy(item.assigneeIds.length)
}

export function receiptTotals(items: AssignedItem[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>()

  for (const item of items) {
    if (item.assigneeIds.length === 0) continue
    const share = item.netAmount.dividedBy(item.assigneeIds.length)

    for (const personId of item.assigneeIds) {
      totals.set(personId, (totals.get(personId) ?? new Decimal(0)).plus(share))
    }
  }

  return totals
}

export function unassignedItems(items: AssignedItem[]): AssignedItem[] {
  return items.filter((item) => item.assigneeIds.length === 0)
}

export function isComplete(items: AssignedItem[]): boolean {
  return unassignedItems(items).length === 0
}

export function balanceFor(shares: Decimal, settlements: Decimal): Decimal {
  return shares.minus(settlements)
}
