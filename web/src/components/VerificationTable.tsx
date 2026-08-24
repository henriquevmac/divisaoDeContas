'use client'

import { parsePtDecimal, formatQuantity, MoneyParseError } from '@/domain/money'
import { canExplode, explode, type DraftItem } from '@/domain/items'

interface Props {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
}

export function VerificationTable({ items, onChange }: Props) {
  function replaceAt(index: number, item: DraftItem) {
    onChange(items.map((existing, i) => (i === index ? item : existing)))
  }

  function editNet(index: number, raw: string) {
    try {
      replaceAt(index, { ...items[index], netAmount: parsePtDecimal(raw) })
    } catch (error) {
      if (!(error instanceof MoneyParseError)) throw error
      // Ignore keystrokes that are not yet a number.
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.key} className="rounded-lg border p-3">
          <input
            aria-label={`Description for ${item.description}`}
            value={item.description}
            onChange={(event) =>
              replaceAt(index, { ...item, description: event.target.value })
            }
            className="w-full border-b bg-transparent pb-1 text-base font-medium"
          />

          <div className="mt-2 flex items-center gap-3 text-sm text-neutral-600">
            <span>{item.category}</span>
            <span>
              {formatQuantity(item.quantity)}
              {item.quantityKind === 'weight' ? ' kg' : '×'}
            </span>
            <label className="ml-auto flex items-center gap-1">
              <input
                aria-label={`Net amount for ${item.description}`}
                defaultValue={item.netAmount.toDecimalPlaces(2).toString().replace('.', ',')}
                onChange={(event) => editNet(index, event.target.value)}
                inputMode="decimal"
                className="w-24 rounded border p-1 text-right tabular-nums"
              />
              <span>€</span>
            </label>
          </div>

          <div className="mt-2 flex gap-3 text-sm">
            {canExplode(item) && (
              <button
                type="button"
                onClick={() =>
                  onChange(items.flatMap((e, i) => (i === index ? explode(e) : [e])))
                }
                className="text-blue-700 underline"
              >
                Explode into {item.quantity.toFixed(0)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="ml-auto text-red-700 underline"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
