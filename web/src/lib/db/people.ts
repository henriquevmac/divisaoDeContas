import { Decimal } from '@/domain/money'
import { createServerSupabase, requireUser } from '@/lib/supabase/server'
import { toDecimal, toNumericString, type PersonRow, type SettlementRow } from './types'

export async function listPeople(): Promise<PersonRow[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('people')
    .select('id, name, is_owner')
    .order('is_owner', { ascending: false })
    .order('name')

  if (error) throw new Error(`Could not list people: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isOwner: row.is_owner,
  }))
}

export async function createPerson(name: string): Promise<void> {
  const user = await requireUser()
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .from('people')
    .insert({ owner_user_id: user.id, name: name.trim(), is_owner: false })

  if (error) {
    throw new Error(
      error.code === '23505'
        ? `There is already someone called ${name.trim()}.`
        : `Could not create the person: ${error.message}`,
    )
  }
}

export async function renamePerson(id: string, name: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('people')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw new Error(`Could not rename: ${error.message}`)
}

/** Refuses to delete the Owner, and refuses if the person still has shares. */
export async function deletePerson(id: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: person } = await supabase
    .from('people')
    .select('is_owner')
    .eq('id', id)
    .single()

  if (person?.is_owner) throw new Error('The Owner cannot be deleted.')

  const { count } = await supabase
    .from('assignments')
    .select('item_id', { count: 'exact', head: true })
    .eq('person_id', id)

  if ((count ?? 0) > 0) {
    throw new Error(
      'This person is still assigned to items. Unassign them first.',
    )
  }

  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(`Could not delete: ${error.message}`)
}

/** Settlements this person was part of, in either direction. */
export async function listSettlements(personId: string): Promise<SettlementRow[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('settlements')
    .select('id, person_id, paid_to_person_id, amount, settled_on, note')
    .or(`person_id.eq.${personId},paid_to_person_id.eq.${personId}`)
    .order('settled_on', { ascending: false })

  if (error) throw new Error(`Could not list settlements: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    personId: row.person_id,
    paidToPersonId: row.paid_to_person_id,
    amount: toDecimal(row.amount),
    settledOn: row.settled_on,
    note: row.note,
  }))
}

/** Records that `fromPersonId` handed `toPersonId` an amount. */
export async function recordSettlement(
  fromPersonId: string,
  toPersonId: string,
  amount: Decimal,
  settledOn: string,
  note: string,
): Promise<void> {
  const user = await requireUser()
  if (fromPersonId === toPersonId) {
    throw new Error('A settlement needs two different people.')
  }

  const supabase = await createServerSupabase()

  const { error } = await supabase.from('settlements').insert({
    owner_user_id: user.id,
    person_id: fromPersonId,
    paid_to_person_id: toPersonId,
    amount: toNumericString(amount),
    settled_on: settledOn,
    note,
  })

  if (error) throw new Error(`Could not record the settlement: ${error.message}`)
}
