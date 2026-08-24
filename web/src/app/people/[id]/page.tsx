import { notFound } from 'next/navigation'
import { Decimal } from '@/domain/money'
import { balanceFor } from '@/domain/shares'
import { listPeople, listSettlements, sharesForPerson } from '@/lib/db/people'
import { settlementToWire } from '@/lib/db/wire'
import { PersonScreen } from './PersonScreen'

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [people, shares, settlements] = await Promise.all([
    listPeople(),
    sharesForPerson(id),
    listSettlements(id),
  ])

  const person = people.find((candidate) => candidate.id === id)
  if (!person) notFound()

  const shareTotal = shares.reduce((sum, share) => sum.plus(share.share), new Decimal(0))
  const settledTotal = settlements.reduce(
    (sum, settlement) => sum.plus(settlement.amount),
    new Decimal(0),
  )

  return (
    <PersonScreen
      personId={person.id}
      name={person.name}
      shares={shares.map((share) => ({
        itemId: share.itemId,
        description: share.description,
        receiptId: share.receiptId,
        merchant: share.merchant,
        purchasedOn: share.purchasedOn,
        share: share.share.toString(),
      }))}
      settlements={settlements.map(settlementToWire)}
      shareTotal={shareTotal.toString()}
      settledTotal={settledTotal.toString()}
      balance={balanceFor(shareTotal, settledTotal).toString()}
    />
  )
}
