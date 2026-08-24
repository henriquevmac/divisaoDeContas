import { describe, it, expect } from 'vitest'
import { parseReceiptFilename } from './filename'

describe('parseReceiptFilename', () => {
  it('parses the sample filename', () => {
    expect(parseReceiptFilename('super_bairro_centro_24-08-2026.csv')).toEqual({
      merchant: 'Super Bairro',
      store: 'Centro',
      purchasedOn: '2026-08-24',
    })
  })

  it('handles a single-word merchant', () => {
    expect(parseReceiptFilename('continente_leiria_01-01-2026.csv')).toEqual({
      merchant: 'Continente',
      store: 'Leiria',
      purchasedOn: '2026-01-01',
    })
  })

  it('ignores a leading path', () => {
    expect(
      parseReceiptFilename('/home/me/super_bairro_centro_24-08-2026.csv').merchant,
    ).toBe('Super Bairro')
  })

  it('returns blank fields for a non-matching filename', () => {
    expect(parseReceiptFilename('receipt.csv')).toEqual({
      merchant: '',
      store: '',
      purchasedOn: '',
    })
  })

  it('returns blank fields when the date is impossible', () => {
    expect(parseReceiptFilename('lidl_porto_32-13-2026.csv')).toEqual({
      merchant: '',
      store: '',
      purchasedOn: '',
    })
  })
})
