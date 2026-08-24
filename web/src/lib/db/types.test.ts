import { describe, it, expect } from 'vitest'
import { Decimal } from '@/domain/money'
import { toDecimal, toNumericString } from './types'

describe('toDecimal', () => {
  it('reads the string Postgres returns for numeric', () => {
    expect(toDecimal('191.2200').toString()).toBe('191.22')
  })

  it('reads a number', () => {
    expect(toDecimal(3).toString()).toBe('3')
  })

  it('treats null as zero', () => {
    expect(toDecimal(null).toString()).toBe('0')
  })
})

describe('toNumericString', () => {
  it('renders with a dot for Postgres', () => {
    expect(toNumericString(new Decimal('1.99'))).toBe('1.99')
  })

  it('truncates an exact repeating share to the column scale', () => {
    // numeric(12,4): four places is what the column stores.
    expect(toNumericString(new Decimal(10).dividedBy(3))).toBe('3.3333')
  })
})
