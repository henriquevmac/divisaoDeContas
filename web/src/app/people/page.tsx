import { debtBreakdownFor } from '@/domain/debts'
import { listPeople } from '@/lib/db/people'
import { allShareEntries, allSettlementEntries } from '@/lib/db/debts'
import { requireUser } from '@/lib/supabase/server'
import { PeopleScreen, type PersonWithBalance } from './PeopleScreen'

export default async function PeoplePage() {
  const [user, people, shares, settlements] = await Promise.all([
    requireUser(),
    listPeople(),
    allShareEntries(),
    allSettlementEntries(),
  ])

  const owner = people.find((person) => person.isOwner)

  const withBalances: PersonWithBalance[] = people.map((person) => {
    const debts = debtBreakdownFor(person.id, shares, settlements)

    // The list is read from the Owner's side: what this person owes you.
    const versusOwner = owner ? debts.get(owner.id)?.net : undefined

    return {
      ...person,
      balance: (versusOwner ?? null)?.toString() ?? null,
      counterpartyCount: debts.size,
    }
  })

  return <PeopleScreen people={withBalances} signedInAs={user.email} />
}
