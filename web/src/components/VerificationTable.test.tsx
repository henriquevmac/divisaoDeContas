import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { parsePtDecimal } from '@/domain/money'
import { VerificationTable } from './VerificationTable'
import type { DraftItem } from '@/domain/items'

function items(): DraftItem[] {
  return [
    {
      key: 'a',
      category: 'BEBIDAS',
      description: 'CERVEJA LOIRA 30X25CL',
      quantity: parsePtDecimal('3'),
      quantityKind: 'count',
      unitPrice: parsePtDecimal('14,95'),
      grossAmount: parsePtDecimal('44,85'),
      discount: parsePtDecimal('0,00'),
      netAmount: parsePtDecimal('44,85'),
    },
    {
      key: 'b',
      category: 'TALHO',
      description: 'PORCO BIFANAS/ASSAR',
      quantity: parsePtDecimal('1,532'),
      quantityKind: 'weight',
      unitPrice: parsePtDecimal('4,99'),
      grossAmount: parsePtDecimal('7,64'),
      discount: parsePtDecimal('0,76'),
      netAmount: parsePtDecimal('6,88'),
    },
  ]
}

describe('VerificationTable', () => {
  it('renders every item', () => {
    render(<VerificationTable items={items()} onChange={() => {}} />)
    expect(screen.getByDisplayValue('CERVEJA LOIRA 30X25CL')).toBeInTheDocument()
    expect(screen.getByDisplayValue('PORCO BIFANAS/ASSAR')).toBeInTheDocument()
  })

  it('offers Explode on a count of 3 but not on a weight', () => {
    render(<VerificationTable items={items()} onChange={() => {}} />)
    expect(screen.getAllByRole('button', { name: /explode/i })).toHaveLength(1)
  })

  it('replaces an item with its units when Explode is pressed', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /explode/i }))

    const next = onChange.mock.calls[0][0] as DraftItem[]
    expect(next).toHaveLength(4)
    expect(next.filter((i) => i.description === 'CERVEJA LOIRA 30X25CL')).toHaveLength(3)
  })

  it('removes an item when Delete is pressed', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect((onChange.mock.calls[0][0] as DraftItem[])).toHaveLength(1)
  })

  it('edits a net amount', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Net amount for CERVEJA LOIRA 30X25CL'), {
      target: { value: '40,00' },
    })
    const next = onChange.mock.calls[0][0] as DraftItem[]
    expect(next[0].netAmount.toString()).toBe('40')
  })
})
