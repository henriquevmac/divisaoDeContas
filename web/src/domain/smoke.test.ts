import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

describe('test harness', () => {
  it('runs and has decimal.js available', () => {
    expect(new Decimal('0.1').plus('0.2').toString()).toBe('0.3')
  })
})
