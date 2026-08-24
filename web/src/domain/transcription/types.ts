import type { Decimal } from '@/domain/money'

export type QuantityKind = 'count' | 'weight'

export interface TranscriptionLine {
  /** Zero-based position in the file, used to keep duplicate rows distinct. */
  position: number
  category: string
  description: string
  quantity: Decimal
  quantityKind: QuantityKind
  unitPrice: Decimal
  grossAmount: Decimal
  discount: Decimal
  netAmount: Decimal
}

export interface TranscriptionTotals {
  gross: Decimal
  discount: Decimal
  net: Decimal
}

export interface ParsedTranscription {
  lines: TranscriptionLine[]
  /** Null when the file has no TOTAL row — reconciliation is then skipped. */
  totals: TranscriptionTotals | null
}
