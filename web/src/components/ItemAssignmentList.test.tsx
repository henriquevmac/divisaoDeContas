import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { parsePtDecimal } from '@/domain/money'
import { ItemAssignmentList } from './ItemAssignmentList'
import type { ItemRow } from '@/lib/db/types'

function item(overrides: Partial<ItemRow>): ItemRow {
  return {
    id: 'i1',
    key: 'i1',
    position: 0,
    category: 'BEBIDAS',
    description: 'AGUA',
    quantity: parsePtDecimal('1'),
    quantityKind: 'count',
    unitPrice: parsePtDecimal('0,50'),
    grossAmount: parsePtDecimal('0,50'),
    discount: parsePtDecimal('0,00'),
    netAmount: parsePtDecimal('0,50'),
    assigneeIds: [],
    ...overrides,
  }
}

const PEOPLE = [
  { id: 'owner', name: 'Antonio', isOwner: true },
  { id: 'ana', name: 'Ana', isOwner: false },
]

const ITEMS = [
  item({ id: 'i1', key: 'i1', category: 'BEBIDAS', description: 'AGUA' }),
  item({ id: 'i2', key: 'i2', category: 'BEBIDAS', description: 'VINHO' }),
  item({ id: 'i3', key: 'i3', category: 'TALHO', description: 'FRANGO' }),
]

describe('ItemAssignmentList', () => {
  it('groups items under their category', () => {
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getByText('BEBIDAS')).toBeInTheDocument()
    expect(screen.getByText('TALHO')).toBeInTheDocument()
  })

  it('selects a single item', () => {
    const onSelectedChange = vi.fn()
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={onSelectedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Select AGUA'))
    expect([...onSelectedChange.mock.calls[0][0]]).toEqual(['i1'])
  })

  it('selects every item in a category at once', () => {
    const onSelectedChange = vi.fn()
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={onSelectedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Select all in BEBIDAS'))
    expect([...onSelectedChange.mock.calls[0][0]].sort()).toEqual(['i1', 'i2'])
  })

  it('marks an unassigned item', () => {
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getAllByText('Unassigned')).toHaveLength(3)
  })

  it('offers Explode only when a handler is given and the item is a count > 1', () => {
    const onExplode = vi.fn()
    render(
      <ItemAssignmentList
        items={[
          item({ id: 'i1', key: 'i1', quantity: parsePtDecimal('3') }),
          item({ id: 'i2', key: 'i2', quantity: parsePtDecimal('1') }),
        ]}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
        onExplode={onExplode}
      />,
    )
    const buttons = screen.getAllByRole('button', { name: /explode/i })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(onExplode).toHaveBeenCalledWith('i1')
  })

  it('names the assignees of an assigned item', () => {
    render(
      <ItemAssignmentList
        items={[item({ id: 'i1', key: 'i1', assigneeIds: ['ana', 'owner'] })]}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getByText('Ana, Antonio')).toBeInTheDocument()
  })
})
