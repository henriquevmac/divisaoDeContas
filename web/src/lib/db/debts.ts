import { Decimal } from '@/domain/money'
import type { ShareEntry, SettlementEntry } from '@/domain/debts'
import { createServerSupabase, requireUser } from '@/lib/supabase/server'
import { toDecimal } from './types'

type RawItem = {
  net_amount: string
  receipts: { payer_person_id: string } | null
  assignments: Array<{ person_id: string }>
}

/**
 * Every share in the account, tagged with who paid the receipt it sits on.
 * Loaded whole because debts are pairwise: working out what one person owes
 * needs every receipt, not just the ones they appear on.
 */
export async function allShareEntries(): Promise<ShareEntry[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('items')
    .select('net_amount, receipts (payer_person_id), assignments (person_id)')

  if (error) throw new Error(`Could not load shares: ${error.message}`)

  const entries: ShareEntry[] = []
  for (const raw of (data ?? []) as unknown as RawItem[]) {
    const payerId = raw.receipts?.payer_person_id
    if (!payerId || raw.assignments.length === 0) continue

    const share = toDecimal(raw.net_amount).dividedBy(raw.assignments.length)
    for (const assignment of raw.assignments) {
      entries.push({ personId: assignment.person_id, payerId, amount: share })
    }
  }
  return entries
}

export async function allSettlementEntries(): Promise<SettlementEntry[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('settlements')
    .select('person_id, paid_to_person_id, amount')

  if (error) throw new Error(`Could not load settlements: ${error.message}`)

  return (data ?? []).map((row) => ({
    fromPersonId: row.person_id,
    toPersonId: row.paid_to_person_id,
    amount: toDecimal(row.amount),
  }))
}

export interface AssignedItemLine {
  itemId: string
  description: string
  receiptId: string
  merchant: string
  purchasedOn: string
  payerPersonId: string
  share: Decimal
}

/** Every item this person is assigned to, with the receipt's payer. */
export async function assignedItemsFor(
  personId: string,
): Promise<AssignedItemLine[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'items (id, description, net_amount, receipt_id, receipts (merchant, purchased_on, payer_person_id), assignments (person_id))',
    )
    .eq('person_id', personId)

  if (error) throw new Error(`Could not load assigned items: ${error.message}`)

  type Raw = {
    items: {
      id: string
      description: string
      net_amount: string
      receipt_id: string
      receipts: {
        merchant: string
        purchased_on: string
        payer_person_id: string
      }
      assignments: Array<{ person_id: string }>
    }
  }

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    itemId: row.items.id,
    description: row.items.description,
    receiptId: row.items.receipt_id,
    merchant: row.items.receipts.merchant,
    purchasedOn: row.items.receipts.purchased_on,
    payerPersonId: row.items.receipts.payer_person_id,
    share: toDecimal(row.items.net_amount).dividedBy(row.items.assignments.length),
  }))
}
