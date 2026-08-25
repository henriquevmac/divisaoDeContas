'use server'

import { revalidatePath } from 'next/cache'
import { Decimal, parsePtDecimal, MoneyParseError } from '@/domain/money'
import { recordSettlement } from '@/lib/db/people'

export async function recordSettlementAction(
  fromPersonId: string,
  toPersonId: string,
  amount: string,
  settledOn: string,
  note: string,
) {
  let parsed: Decimal
  try {
    parsed = parsePtDecimal(amount)
  } catch (error) {
    if (error instanceof MoneyParseError) return { error: 'Enter an amount like 23,40.' }
    throw error
  }

  if (parsed.isZero()) return { error: 'A settlement cannot be zero.' }
  if (!toPersonId) return { error: 'Choose who they paid.' }

  try {
    await recordSettlement(fromPersonId, toPersonId, parsed, settledOn, note)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record it.' }
  }

  revalidatePath(`/people/${fromPersonId}`)
  revalidatePath(`/people/${toPersonId}`)
  revalidatePath('/people')
}
