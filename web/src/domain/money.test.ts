import { describe, it, expect } from 'vitest'
import {
  parsePtDecimal,
  formatEuro,
  formatQuantity,
  isWholeNumber,
  MoneyParseError,
} from './money'

describe('parsePtDecimal', () => {
  it('parses a decimal comma', () => {
    expect(parsePtDecimal('1,15').toString()).toBe('1.15')
  })

  it('parses a thousands separator', () => {
    expect(parsePtDecimal('1.234,56').toString()).toBe('1234.56')
  })

  it('parses an integer', () => {
    expect(parsePtDecimal('3').toString()).toBe('3')
  })

  it('parses a three-decimal weight', () => {
    expect(parsePtDecimal('1,532').toString()).toBe('1.532')
  })

  it('parses zero', () => {
    expect(parsePtDecimal('0,00').toString()).toBe('0')
  })

  it('trims surrounding whitespace', () => {
    expect(parsePtDecimal('  2,50  ').toString()).toBe('2.5')
  })

  it('rejects an empty string', () => {
    expect(() => parsePtDecimal('')).toThrow(MoneyParseError)
  })

  it('rejects non-numeric text', () => {
    expect(() => parsePtDecimal('TOTAL')).toThrow(MoneyParseError)
  })
})

describe('formatEuro', () => {
  it('formats with a decimal comma and two places', () => {
    // Non-breaking spaces vary by ICU build, so normalise whitespace.
    const formatted = formatEuro(parsePtDecimal('191,22')).replace(/\s/g, ' ')
    expect(formatted).toBe('191,22 €')
  })

  it('rounds a repeating share to two places', () => {
    const third = parsePtDecimal('10,00').dividedBy(3)
    expect(formatEuro(third).replace(/\s/g, ' ')).toBe('3,33 €')
  })
})

describe('formatQuantity', () => {
  it('shows a whole number without decimals', () => {
    expect(formatQuantity(parsePtDecimal('6,000'))).toBe('6')
  })

  it('shows a weight with three decimals', () => {
    expect(formatQuantity(parsePtDecimal('1,532'))).toBe('1,532')
  })
})

describe('isWholeNumber', () => {
  it('is true for 6,000', () => {
    expect(isWholeNumber(parsePtDecimal('6,000'))).toBe(true)
  })

  it('is false for 0,436', () => {
    expect(isWholeNumber(parsePtDecimal('0,436'))).toBe(false)
  })
})
