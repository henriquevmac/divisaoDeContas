import { notFound } from 'next/navigation'
import { debtBreakdownFor } from '@/domain/debts'
import { listPeople, listSettlements } from '@/lib/db/people'
import {
  allShareEntries,
  allSettlementEntries,
  assignedItemsFor,
} from '@/lib/db/debts'
import { settlementToWire, type DebtWire } from '@/lib/db/wire'
import { PersonScreen } from './PersonScreen'

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [people, items, settlements, shares, allSettlements] = await Promise.all([
    listPeople(),
    assignedItemsFor(id),
    listSettlements(id),
    allShareEntries(),
    allSettlementEntries(),
  ])

  const person = people.find((candidate) => candidate.id === id)
  if (!person) notFound()

  const nameOf = new Map(people.map((candidate) => [candidate.id, candidate.name]))

  const debts: DebtWire[] = [...debtBreakdownFor(id, shares, allSettlements)]
    .map(([counterpartyId, breakdown]) => ({
      counterpartyId,
      counterpartyName: nameOf.get(counterpartyId) ?? 'unknown',
      sharesOwed: breakdown.sharesOwed.toString(),
      sharesLent: breakdown.sharesLent.toString(),
      paid: breakdown.paid.toString(),
      received: breakdown.received.toString(),
      outstandingOwed: breakdown.outstandingOwed.toString(),
      outstandingLent: breakdown.outstandingLent.toString(),
      net: breakdown.net.toString(),
    }))
    .sort((a, b) => a.counterpartyName.localeCompare(b.counterpartyName))

  return (
    <PersonScreen
      personId={person.id}
      name={person.name}
      debts={debts}
      people={people.filter((candidate) => candidate.id !== id)}
      items={items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        receiptId: item.receiptId,
        merchant: item.merchant,
        purchasedOn: item.purchasedOn,
        payerPersonId: item.payerPersonId,
        payerName: nameOf.get(item.payerPersonId) ?? 'unknown',
        share: item.share.toString(),
      }))}
      settlements={settlements.map(settlementToWire)}
      nameOf={Object.fromEntries(nameOf)}
    />
  )
}
