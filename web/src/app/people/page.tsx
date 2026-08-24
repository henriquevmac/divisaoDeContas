import { Decimal } from '@/domain/money'
import { balanceFor } from '@/domain/shares'
import { listPeople, listSettlements, sharesForPerson } from '@/lib/db/people'
import { requireUser } from '@/lib/supabase/server'
import { PeopleScreen, type PersonWithBalance } from './PeopleScreen'

export default async function PeoplePage() {
  const [user, people] = await Promise.all([requireUser(), listPeople()])

  const withBalances: PersonWithBalance[] = await Promise.all(
    people.map(async (person) => {
      const [shares, settlements] = await Promise.all([
        sharesForPerson(person.id),
        listSettlements(person.id),
      ])

      const shareTotal = shares.reduce(
        (sum, share) => sum.plus(share.share),
        new Decimal(0),
      )
      const settledTotal = settlements.reduce(
        (sum, settlement) => sum.plus(settlement.amount),
        new Decimal(0),
      )

      return {
        ...person,
        balance: balanceFor(shareTotal, settledTotal).toString(),
      }
    }),
  )

  return <PeopleScreen people={withBalances} signedInAs={user.email} />
}
