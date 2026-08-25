import type { Slice } from '@/domain/stats'

/**
 * Deliberately NOT a 'use client' module. Server Components read MAX_SERIES to
 * decide how many slices to build, and a value imported from a client module
 * arrives as a client-reference proxy rather than the number — which silently
 * folded every person into "Other".
 *
 * Fixed order, never cycled. All eight clear the validator's CVD and
 * normal-vision floors on the adjacent pairlist in both themes, which is the
 * right list for a pie whose slices sit next to each other in this order.
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
