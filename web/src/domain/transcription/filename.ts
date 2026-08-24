export interface ReceiptMetadata {
  merchant: string
  store: string
  /** ISO date, YYYY-MM-DD. Empty when the filename did not carry one. */
  purchasedOn: string
}

const BLANK: ReceiptMetadata = { merchant: '', store: '', purchasedOn: '' }

const PATTERN = /^(.+)_([^_]+)_(\d{2})-(\d{2})-(\d{4})$/

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Best-effort read of `<merchant>_<store>_<DD-MM-YYYY>.csv`. A filename that
 * does not match is not an error — the user fills the fields in by hand.
 */
export function parseReceiptFilename(filename: string): ReceiptMetadata {
  const base = filename.split('/').pop() ?? filename
  const stem = base.replace(/\.csv$/i, '')

  const match = PATTERN.exec(stem)
  if (!match) return { ...BLANK }

  const [, merchantPart, storePart, day, month, year] = match
  if (!isRealDate(Number(year), Number(month), Number(day))) return { ...BLANK }

  return {
    merchant: titleCase(merchantPart),
    store: titleCase(storePart),
    purchasedOn: `${year}-${month}-${day}`,
  }
}
