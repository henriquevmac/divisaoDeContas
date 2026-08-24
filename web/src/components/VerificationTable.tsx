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
        <li key={item.key} className="rounded-xl border border-rule bg-card p-3">
          <input
            aria-label={`Description for ${item.description}`}
            value={item.description}
            onChange={(event) =>
              replaceAt(index, { ...item, description: event.target.value })
            }
            className="w-full border-b border-rule bg-transparent pb-1.5 text-base font-medium focus:border-ink"
          />

          <div className="mt-3 flex items-center gap-3">
            <span className="eyebrow truncate">{item.category || '—'}</span>
            <span className="font-mono text-xs tabular-nums text-muted">
              {formatQuantity(item.quantity)}
              {item.quantityKind === 'weight' ? ' kg' : '×'}
            </span>
            <label className="ml-auto flex shrink-0 items-center gap-1.5">
              <input
                aria-label={`Net amount for ${item.description}`}
                defaultValue={item.netAmount
                  .toDecimalPlaces(2)
                  .toString()
                  .replace('.', ',')}
                onChange={(event) => editNet(index, event.target.value)}
                inputMode="decimal"
                className="w-24 rounded-lg border border-rule bg-paper p-2 text-right font-mono text-base tabular-nums focus:border-ink"
              />
              <span className="text-muted">€</span>
            </label>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm">
            {canExplode(item) && (
              <button
                type="button"
                onClick={() =>
                  onChange(items.flatMap((e, i) => (i === index ? explode(e) : [e])))
                }
                className="min-h-11 text-muted underline underline-offset-2"
              >
                Explode into {item.quantity.toFixed(0)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="ml-auto min-h-11 text-accent underline underline-offset-2"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
