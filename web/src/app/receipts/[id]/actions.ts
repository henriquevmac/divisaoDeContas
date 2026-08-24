'use server'

import { revalidatePath } from 'next/cache'
import { setAssignments, addAssignments } from '@/lib/db/assignments'
import { explodeItem } from '@/lib/db/receipts'

export async function assignAction(
  receiptId: string,
  itemIds: string[],
  personIds: string[],
  mode: 'replace' | 'add',
) {
  if (mode === 'add') await addAssignments(itemIds, personIds)
  else await setAssignments(itemIds, personIds)

  revalidatePath(`/receipts/${receiptId}`)
  revalidatePath('/people')
}

export async function explodeItemAction(receiptId: string, itemId: string) {
  await explodeItem(itemId)
  revalidatePath(`/receipts/${receiptId}`)
}
