import { Decimal } from '@/domain/money'
import { spendByPerson, toSlices } from '@/domain/stats'
import { listPeople } from '@/lib/db/people'
import { allShareEntries } from '@/lib/db/debts'
import { listReceipts } from '@/lib/db/receipts'
import { StatsScreen, type SliceWire } from './StatsScreen'

/** A pie stays readable at a glance only with a handful of segments. */
const MAX_SLICES = 6

export default async function StatsPage() {
  const [people, shares, receipts] = await Promise.all([
    listPeople(),
    allShareEntries(),
    listReceipts(),
  ])

  const nameOf = new Map(people.map((person) => [person.id, person.name]))
  const spend = spendByPerson(shares)

  const slices: SliceWire[] = toSlices(
    [...spend.entries()].map(([personId, amount]) => ({
      id: personId,
      label: nameOf.get(personId) ?? 'unknown',
      amount,
    })),
    MAX_SLICES,
  ).map((slice) => ({ ...slice, amount: slice.amount.toString() }))

  const assigned = [...spend.values()].reduce(
    (sum, amount) => sum.plus(amount),
    new Decimal(0),
  )
  const everything = receipts.reduce((sum, receipt) => sum.plus(receipt.net), new Decimal(0))

  return (
    <StatsScreen
      slices={slices}
      total={assigned.toString()}
      unassigned={everything.minus(assigned).toString()}
      receiptCount={receipts.length}
      itemCount={receipts.reduce((sum, receipt) => sum + receipt.itemCount, 0)}
    />
  )
}
