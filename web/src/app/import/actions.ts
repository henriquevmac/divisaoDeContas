'use server'

import { redirect } from 'next/navigation'
import { Decimal } from '@/domain/money'
import { nextItemKey } from '@/domain/items'
import { saveVerifiedReceipt } from '@/lib/db/receipts'

/** Amounts arrive as plain decimal strings, already validated client-side. */
export interface SerialisedItem {
  category: string
  description: string
  quantity: string
  quantityKind: 'count' | 'weight'
  unitPrice: string
  grossAmount: string
  discount: string
  netAmount: string
}

export async function saveReceiptAction(payload: {
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
  sourceFilename: string
  sourceCsv: string
  statedGross: string | null
  statedDiscount: string | null
  statedNet: string | null
  items: SerialisedItem[]
}) {
  const id = await saveVerifiedReceipt({
    merchant: payload.merchant,
    store: payload.store,
    purchasedOn: payload.purchasedOn,
    payerPersonId: payload.payerPersonId,
    sourceFilename: payload.sourceFilename,
    sourceCsv: payload.sourceCsv,
    statedGross: payload.statedGross ? new Decimal(payload.statedGross) : null,
    statedDiscount: payload.statedDiscount
      ? new Decimal(payload.statedDiscount)
      : null,
    statedNet: payload.statedNet ? new Decimal(payload.statedNet) : null,
    items: payload.items.map((item) => ({
      key: nextItemKey(),
      category: item.category,
      description: item.description,
      quantity: new Decimal(item.quantity),
      quantityKind: item.quantityKind,
      unitPrice: new Decimal(item.unitPrice),
      grossAmount: new Decimal(item.grossAmount),
      discount: new Decimal(item.discount),
      netAmount: new Decimal(item.netAmount),
    })),
  })

  redirect(`/receipts/${id}`)
}
