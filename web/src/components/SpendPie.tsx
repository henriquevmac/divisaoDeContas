'use client'

import { useState } from 'react'
import { Decimal, formatEuro } from '@/domain/money'
import type { Slice } from '@/domain/stats'
import { pointOn, wedgePath, PIE_RADIUS, PIE_SIZE } from './pie-geometry'

/**
 * Fixed order, never cycled. All eight clear the validator's CVD and
 * normal-vision floors on the adjacent pairlist in both themes — which is the
 * right list for a pie, whose slices sit next to each other in this order.
 */
const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
]

export const MAX_SERIES = SERIES.length

export function colourFor(slice: Slice, index: number): string {
  if (slice.id === 'other') return 'var(--series-other)'
  // Past the palette a hue is never generated — toSlices folds the tail first,
  // so this clamp should be unreachable.
  return SERIES[Math.min(index, SERIES.length - 1)]
}

/** Slices below this are too thin to carry a legible label inside the wedge. */
const LABEL_THRESHOLD = 0.08

interface Props {
  slices: Slice[]
  total: Decimal
}

export function SpendPie({ slices, total }: Props) {
  const [active, setActive] = useState<string | null>(null)

  let cursor = 0
  const wedges = slices.map((slice, index) => {
    const start = cursor
    cursor += slice.fraction
    return {
      slice,
      index,
      start,
      end: cursor,
      mid: start + slice.fraction / 2,
      colour: colourFor(slice, index),
    }
  })

  const selected = wedges.find((wedge) => wedge.slice.id === active)

  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
          width={PIE_SIZE}
          height={PIE_SIZE}
          role="img"
          aria-label={`Spend by person, ${formatEuro(total)} in total`}
          className="max-w-full"
        >
          {wedges.map((wedge) => (
            <path
              key={wedge.slice.id}
              d={wedgePath(wedge.start, wedge.end)}
              fill={wedge.colour}
              /* A 2px surface gap keeps adjacent fills from bleeding together. */
              stroke="var(--card)"
              strokeWidth={2}
              opacity={active && active !== wedge.slice.id ? 0.35 : 1}
              onMouseEnter={() => setActive(wedge.slice.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() =>
                setActive(active === wedge.slice.id ? null : wedge.slice.id)
              }
              className="cursor-pointer"
            />
          ))}

          {wedges
            .filter((wedge) => wedge.slice.fraction >= LABEL_THRESHOLD)
            .map((wedge) => {
              const at = pointOn(wedge.mid, PIE_RADIUS * 0.66)
              return (
                <text
                  key={`label-${wedge.slice.id}`}
                  x={at.x}
                  y={at.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  /* Direct labels are the relief the palette's contrast WARN requires. */
                  className="pointer-events-none fill-white font-mono text-[11px] font-medium"
                >
                  {Math.round(wedge.slice.fraction * 100)}%
                </text>
              )
            })}
        </svg>
      </div>

      <figcaption className="text-center text-sm text-muted">
        {selected ? (
          <>
            <span className="font-medium text-ink">{selected.slice.label}</span>{' '}
            — {formatEuro(selected.slice.amount)} of {formatEuro(total)}
            {selected.slice.id === 'other' &&
              ` · ${selected.slice.foldedCount} people`}
          </>
        ) : (
          <>Tap a slice for its share</>
        )}
      </figcaption>
    </figure>
  )
}
