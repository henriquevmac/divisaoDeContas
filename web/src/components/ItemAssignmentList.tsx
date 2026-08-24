'use client'

import { formatQuantity } from '@/domain/money'
import { canExplode } from '@/domain/items'
import { Money } from './Money'
import type { ItemRow, PersonRow } from '@/lib/db/types'

interface Props {
  items: ItemRow[]
  people: PersonRow[]
  selected: Set<string>
  onSelectedChange: (selected: Set<string>) => void
  /** Omitted in tests and wherever exploding is not offered. */
  onExplode?: (itemId: string) => void
}

function groupByCategory(items: ItemRow[]): Array<[string, ItemRow[]]> {
  const groups = new Map<string, ItemRow[]>()
  for (const item of items) {
    const key = item.category || 'Uncategorised'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
}

export function ItemAssignmentList({
  items,
  people,
  selected,
  onSelectedChange,
  onExplode,
}: Props) {
  const nameOf = new Map(people.map((person) => [person.id, person.name]))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function toggleCategory(categoryItems: ItemRow[]) {
    const allSelected = categoryItems.every((item) => selected.has(item.id))
    const next = new Set(selected)
    for (const item of categoryItems) {
      if (allSelected) next.delete(item.id)
      else next.add(item.id)
    }
    onSelectedChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByCategory(items).map(([category, categoryItems]) => (
        <section key={category}>
          <header className="flex items-center gap-2 border-b py-1">
            <input
              type="checkbox"
              aria-label={`Select all in ${category}`}
              checked={categoryItems.every((item) => selected.has(item.id))}
              onChange={() => toggleCategory(categoryItems)}
              className="size-5"
            />
            <h2 className="text-sm font-semibold text-neutral-600">{category}</h2>
          </header>

          <ul>
            {categoryItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 border-b py-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.description}`}
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="size-5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.description}</p>
                  <p className="text-xs text-neutral-500">
                    {formatQuantity(item.quantity)}
                    {item.quantityKind === 'weight' ? ' kg · ' : '× · '}
                    {item.assigneeIds.length === 0 ? (
                      <span className="font-medium text-red-700">Unassigned</span>
                    ) : (
                      <span>
                        {item.assigneeIds
                          .map((id) => nameOf.get(id) ?? '?')
                          .sort()
                          .join(', ')}
                      </span>
                    )}
                  </p>
                </div>
                {onExplode && canExplode(item) && (
                  <button
                    type="button"
                    onClick={() => onExplode(item.id)}
                    className="text-xs text-blue-700 underline"
                  >
                    Explode
                  </button>
                )}
                <Money value={item.netAmount} className="text-sm" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
