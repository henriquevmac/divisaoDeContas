import { Decimal } from '@/domain/money'
import { canExplode, explode, type DraftItem } from '@/domain/items'
import { createServerSupabase, requireUser } from '@/lib/supabase/server'
import { toDecimal, toNumericString, type ItemRow, type ReceiptRow } from './types'

export interface SaveReceiptInput {
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
  sourceFilename: string
  sourceCsv: string
  statedGross: Decimal | null
  statedDiscount: Decimal | null
  statedNet: Decimal | null
  items: DraftItem[]
}

export async function saveVerifiedReceipt(
  input: SaveReceiptInput,
): Promise<string> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc('save_verified_receipt', {
    p_merchant: input.merchant,
    p_store: input.store,
    p_purchased_on: input.purchasedOn,
    p_payer_person_id: input.payerPersonId,
    p_source_filename: input.sourceFilename,
    p_source_csv: input.sourceCsv,
    p_stated_gross: input.statedGross ? toNumericString(input.statedGross) : null,
    p_stated_discount: input.statedDiscount
      ? toNumericString(input.statedDiscount)
      : null,
    p_stated_net: input.statedNet ? toNumericString(input.statedNet) : null,
    p_items: input.items.map((item, position) => ({
      position,
      category: item.category,
      description: item.description,
      quantity: toNumericString(item.quantity),
      quantityKind: item.quantityKind,
      unitPrice: toNumericString(item.unitPrice),
      grossAmount: toNumericString(item.grossAmount),
      discount: toNumericString(item.discount),
      netAmount: toNumericString(item.netAmount),
    })),
  })

  if (error) throw new Error(`Could not save the receipt: ${error.message}`)
  return data as string
}

const ITEM_COLUMNS =
  'id, position, category, description, quantity, quantity_kind, unit_price, gross_amount, discount, net_amount, assignments (person_id)'

type RawItem = {
  id: string
  position: number
  category: string
  description: string
  quantity: string
  quantity_kind: 'count' | 'weight'
  unit_price: string
  gross_amount: string
  discount: string
  net_amount: string
  assignments: Array<{ person_id: string }>
}

function mapItem(raw: RawItem): ItemRow {
  return {
    id: raw.id,
    key: raw.id,
    position: raw.position,
    category: raw.category,
    description: raw.description,
    quantity: toDecimal(raw.quantity),
    quantityKind: raw.quantity_kind,
    unitPrice: toDecimal(raw.unit_price),
    grossAmount: toDecimal(raw.gross_amount),
    discount: toDecimal(raw.discount),
    netAmount: toDecimal(raw.net_amount),
    assigneeIds: raw.assignments.map((a) => a.person_id),
  }
}

export async function getReceipt(
  id: string,
): Promise<{ receipt: ReceiptRow; items: ItemRow[] } | null> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, merchant, store, purchased_on, payer_person_id, stated_net')
    .eq('id', id)
    .maybeSingle()

  if (!receipt) return null

  const { data: items, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('receipt_id', id)
    .order('position')

  if (error) throw new Error(`Could not load items: ${error.message}`)

  return {
    receipt: {
      id: receipt.id,
      merchant: receipt.merchant,
      store: receipt.store,
      purchasedOn: receipt.purchased_on,
      payerPersonId: receipt.payer_person_id,
      statedNet: receipt.stated_net ? toDecimal(receipt.stated_net) : null,
    },
    items: (items as unknown as RawItem[]).map(mapItem),
  }
}

export interface ReceiptSummary extends ReceiptRow {
  itemCount: number
  net: Decimal
  unassignedCount: number
}

export async function listReceipts(): Promise<ReceiptSummary[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('receipts')
    .select(
      `id, merchant, store, purchased_on, payer_person_id, stated_net, items (${ITEM_COLUMNS})`,
    )
    .order('purchased_on', { ascending: false })

  if (error) throw new Error(`Could not list receipts: ${error.message}`)

  return (data ?? []).map((row) => {
    const items = ((row.items ?? []) as unknown as RawItem[]).map(mapItem)
    return {
      id: row.id,
      merchant: row.merchant,
      store: row.store,
      purchasedOn: row.purchased_on,
      payerPersonId: row.payer_person_id,
      statedNet: row.stated_net ? toDecimal(row.stated_net) : null,
      itemCount: items.length,
      net: items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0)),
      unassignedCount: items.filter((item) => item.assigneeIds.length === 0).length,
    }
  })
}

/** Replaces a saved item with its exploded units, preserving assignments. */
export async function explodeItem(itemId: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: raw, error } = await supabase
    .from('items')
    .select(`receipt_id, ${ITEM_COLUMNS}`)
    .eq('id', itemId)
    .single()

  if (error || !raw) throw new Error('Item not found')

  const original = mapItem(raw as unknown as RawItem)
  if (!canExplode(original)) throw new Error('This item cannot be exploded')

  const parts = explode(original)
  const receiptId = (raw as { receipt_id: string }).receipt_id

  const { data: inserted, error: insertError } = await supabase
    .from('items')
    .insert(
      parts.map((part, offset) => ({
        receipt_id: receiptId,
        position: original.position + offset,
        category: part.category,
        description: part.description,
        quantity: toNumericString(part.quantity),
        quantity_kind: part.quantityKind,
        unit_price: toNumericString(part.unitPrice),
        gross_amount: toNumericString(part.grossAmount),
        discount: toNumericString(part.discount),
        net_amount: toNumericString(part.netAmount),
      })),
    )
    .select('id')

  if (insertError) throw new Error(`Could not explode: ${insertError.message}`)

  if (original.assigneeIds.length > 0) {
    await supabase.from('assignments').insert(
      inserted!.flatMap((row) =>
        original.assigneeIds.map((personId) => ({
          item_id: row.id,
          person_id: personId,
        })),
      ),
    )
  }

  await supabase.from('items').delete().eq('id', itemId)
}

/**
 * Deletes a receipt and, by cascade, its items and their assignments.
 * Settlements are deliberately untouched: they record money that actually
 * changed hands, so removing a receipt can leave someone in credit rather than
 * rewriting history (ADR-0003).
 */
export async function deleteReceipt(id: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { error } = await supabase.from('receipts').delete().eq('id', id)
  if (error) throw new Error(`Could not delete the receipt: ${error.message}`)
}

export interface ReceiptDetails {
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
}

/**
 * Corrects a saved receipt's details. Changing the Payer re-points every debt
 * on this receipt at a different person, which is the whole point: the payer is
 * easy to get wrong at import time and expensive to be stuck with.
 */
export async function updateReceipt(
  id: string,
  details: ReceiptDetails,
): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .from('receipts')
    .update({
      merchant: details.merchant.trim(),
      store: details.store.trim(),
      purchased_on: details.purchasedOn,
      payer_person_id: details.payerPersonId,
    })
    .eq('id', id)

  if (error) throw new Error(`Could not update the receipt: ${error.message}`)
}
