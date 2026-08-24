import { parsePtDecimal, isWholeNumber, MoneyParseError } from '@/domain/money'
import type {
  ParsedTranscription,
  TranscriptionLine,
  TranscriptionTotals,
} from './types'

export class TranscriptionParseError extends Error {
  /** One-based row number as a human counts lines in the file. */
  readonly row: number

  constructor(row: number, detail: string) {
    super(`Could not read row ${row}: ${detail}`)
    this.name = 'TranscriptionParseError'
    this.row = row
  }
}

const COLUMN_COUNT = 7
const TOTAL_MARKER = 'TOTAL'

function splitRows(csv: string): string[] {
  return csv.replace(/^﻿/, '').split(/\r?\n/)
}

function looksLikeHeader(row: string): boolean {
  return row.toLowerCase().startsWith('categoria;')
}

export function parseTranscription(csv: string): ParsedTranscription {
  const rows = splitRows(csv)
  const firstNonBlank = rows.findIndex((row) => row.trim() !== '')

  if (firstNonBlank === -1) {
    throw new TranscriptionParseError(1, 'the file is empty')
  }
  if (!looksLikeHeader(rows[firstNonBlank])) {
    throw new TranscriptionParseError(
      firstNonBlank + 1,
      'expected the header row starting with "Categoria;"',
    )
  }

  const lines: TranscriptionLine[] = []
  let totals: TranscriptionTotals | null = null

  for (let index = firstNonBlank + 1; index < rows.length; index += 1) {
    const raw = rows[index]
    if (raw.trim() === '') continue

    const rowNumber = index + 1
    const cells = raw.split(';').map((cell) => cell.trim())

    if (cells.length !== COLUMN_COUNT) {
      throw new TranscriptionParseError(
        rowNumber,
        `expected ${COLUMN_COUNT} columns, found ${cells.length}`,
      )
    }

    const [category, description, quantity, unitPrice, gross, discount, net] =
      cells

    try {
      if (description.toUpperCase() === TOTAL_MARKER) {
        totals = {
          gross: parsePtDecimal(gross),
          discount: parsePtDecimal(discount),
          net: parsePtDecimal(net),
        }
        continue
      }

      const parsedQuantity = parsePtDecimal(quantity)
      lines.push({
        position: lines.length,
        category,
        description,
        quantity: parsedQuantity,
        quantityKind: isWholeNumber(parsedQuantity) ? 'count' : 'weight',
        unitPrice: parsePtDecimal(unitPrice),
        grossAmount: parsePtDecimal(gross),
        discount: parsePtDecimal(discount),
        netAmount: parsePtDecimal(net),
      })
    } catch (error) {
      if (error instanceof MoneyParseError) {
        throw new TranscriptionParseError(rowNumber, error.message)
      }
      throw error
    }
  }

  return { lines, totals }
}
