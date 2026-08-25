/**
 * Decimal instances cannot cross the Server → Client component boundary: Next
 * only serialises plain values through props. Server Components therefore
 * convert money to strings on the way out, and Client Components rehydrate it
 * on the way in. Strings keep the value exact — unlike numbers, which would
 * reintroduce floats and violate the money rule in ADR-0002.
 */
import { Decimal } from '@/domain/money'
import type { ItemRow, ReceiptRow, SettlementRow } from './types'
import type { QuantityKind } from '@/domain/transcription/types'

export interface ItemWire {
  id: string
  position: number
  category: string
  description: string
  quantity: string
  quantityKind: QuantityKind
  unitPrice: string
  grossAmount: string
  discount: string
  netAmount: string
  assigneeIds: string[]
}

export function itemToWire(item: ItemRow): ItemWire {
  return {
    id: item.id,
    position: item.position,
    category: item.category,
    description: item.description,
    quantity: item.quantity.toString(),
    quantityKind: item.quantityKind,
    unitPrice: item.unitPrice.toString(),
    grossAmount: item.grossAmount.toString(),
    discount: item.discount.toString(),
    netAmount: item.netAmount.toString(),
    assigneeIds: item.assigneeIds,
  }
}

export function itemFromWire(wire: ItemWire): ItemRow {
  return {
    id: wire.id,
    key: wire.id,
    position: wire.position,
    category: wire.category,
    description: wire.description,
    quantity: new Decimal(wire.quantity),
    quantityKind: wire.quantityKind,
    unitPrice: new Decimal(wire.unitPrice),
    grossAmount: new Decimal(wire.grossAmount),
    discount: new Decimal(wire.discount),
    netAmount: new Decimal(wire.netAmount),
    assigneeIds: wire.assigneeIds,
  }
}

export interface ReceiptWire {
  id: string
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
  statedNet: string | null
}

export function receiptToWire(receipt: ReceiptRow): ReceiptWire {
  return {
    id: receipt.id,
    merchant: receipt.merchant,
    store: receipt.store,
    purchasedOn: receipt.purchasedOn,
    payerPersonId: receipt.payerPersonId,
    statedNet: receipt.statedNet ? receipt.statedNet.toString() : null,
  }
}

export interface SettlementWire {
  id: string
  personId: string
  paidToPersonId: string
  amount: string
  settledOn: string
  note: string
}

export function settlementToWire(settlement: SettlementRow): SettlementWire {
  return {
    id: settlement.id,
    personId: settlement.personId,
    paidToPersonId: settlement.paidToPersonId,
    amount: settlement.amount.toString(),
    settledOn: settlement.settledOn,
    note: settlement.note,
  }
}

export interface ShareWire {
  itemId: string
  description: string
  receiptId: string
  merchant: string
  purchasedOn: string
  payerPersonId: string
  share: string
}

/** One counterparty's position, serialised for the client. */
export interface DebtWire {
  counterpartyId: string
  counterpartyName: string
  sharesOwed: string
  sharesLent: string
  paid: string
  received: string
  outstandingOwed: string
  outstandingLent: string
  net: string
}
