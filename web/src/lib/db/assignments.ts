import { createServerSupabase, requireUser } from '@/lib/supabase/server'

/**
 * Replaces the assignments of every listed item with exactly `personIds`.
 * An empty `personIds` unassigns them.
 */
export async function setAssignments(
  itemIds: string[],
  personIds: string[],
): Promise<void> {
  await requireUser()
  if (itemIds.length === 0) return

  const supabase = await createServerSupabase()

  const { error: deleteError } = await supabase
    .from('assignments')
    .delete()
    .in('item_id', itemIds)

  if (deleteError) throw new Error(`Could not clear assignments: ${deleteError.message}`)
  if (personIds.length === 0) return

  const rows = itemIds.flatMap((itemId) =>
    personIds.map((personId) => ({ item_id: itemId, person_id: personId })),
  )

  const { error } = await supabase.from('assignments').insert(rows)
  if (error) throw new Error(`Could not assign: ${error.message}`)
}

/** Adds people to items without removing anyone already assigned. */
export async function addAssignments(
  itemIds: string[],
  personIds: string[],
): Promise<void> {
  await requireUser()
  if (itemIds.length === 0 || personIds.length === 0) return

  const supabase = await createServerSupabase()
  const rows = itemIds.flatMap((itemId) =>
    personIds.map((personId) => ({ item_id: itemId, person_id: personId })),
  )

  const { error } = await supabase
    .from('assignments')
    .upsert(rows, { onConflict: 'item_id,person_id', ignoreDuplicates: true })

  if (error) throw new Error(`Could not assign: ${error.message}`)
}
