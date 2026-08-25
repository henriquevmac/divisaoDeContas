import { Decimal } from '@/domain/money'
import type { DraftItem } from '@/domain/items'

/** Scale of every numeric column in the schema. */
export const MONEY_SCALE = 4

export function toDecimal(value: string | number | null): Decimal {
  if (value === null) return new Decimal(0)
  return new Decimal(value)
}

export function toNumericString(value: Decimal): string {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toString()
}

export interface PersonRow {
  id: string
  name: string
  isOwner: boolean
}

export interface ReceiptRow {
  id: string
  merchant: string
  store: string
  /** ISO date, YYYY-MM-DD. */
  purchasedOn: string
  payerPersonId: string
  statedNet: Decimal | null
}

export interface ItemRow extends DraftItem {
  /** Database id. `key` from DraftItem mirrors it for React. */
  id: string
  position: number
  assigneeIds: string[]
}

export interface SettlementRow {
  id: string
  /** Who handed the money over. */
  personId: string
  /** Who received it. */
  paidToPersonId: string
  amount: Decimal
  settledOn: string
  note: string
}
