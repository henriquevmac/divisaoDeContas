import Decimal from 'decimal.js'

export { Decimal }

export class MoneyParseError extends Error {
  constructor(input: string) {
    super(`Not a valid Portuguese decimal: ${JSON.stringify(input)}`)
    this.name = 'MoneyParseError'
  }
}

/**
 * Parses Portuguese number notation: "." groups thousands, "," is the decimal
 * separator. Returns an exact Decimal — never a float.
 */
export function parsePtDecimal(input: string): Decimal {
  const trimmed = input.trim()
  if (trimmed === '') throw new MoneyParseError(input)

  const normalised = trimmed.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) throw new MoneyParseError(input)

  return new Decimal(normalised)
}

const euroFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

/** Rounds to the cent for display only. Stored values stay exact (ADR-0002). */
export function formatEuro(value: Decimal): string {
  return euroFormatter.format(value.toDecimalPlaces(2).toNumber())
}

export function isWholeNumber(value: Decimal): boolean {
  return value.isInteger()
}

export function formatQuantity(value: Decimal): string {
  if (isWholeNumber(value)) return value.toFixed(0)
  return value.toFixed(3).replace('.', ',')
}
