export const PIE_SIZE = 240
export const PIE_RADIUS = 104
const CENTRE = PIE_SIZE / 2

/** Twelve o'clock is zero and fractions run clockwise, as a reader expects. */
export function pointOn(fraction: number, radius: number) {
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  return {
    x: CENTRE + radius * Math.cos(angle),
    y: CENTRE + radius * Math.sin(angle),
  }
}

/**
 * An SVG arc cannot express a full turn — start and end coincide and the
 * renderer draws nothing — so a lone slice is built from two half sweeps.
 */
export function wedgePath(start: number, end: number): string {
  if (end - start >= 1) {
    const top = pointOn(0, PIE_RADIUS)
    const bottom = pointOn(0.5, PIE_RADIUS)
    return [
      `M ${top.x} ${top.y}`,
      `A ${PIE_RADIUS} ${PIE_RADIUS} 0 0 1 ${bottom.x} ${bottom.y}`,
      `A ${PIE_RADIUS} ${PIE_RADIUS} 0 0 1 ${top.x} ${top.y}`,
      'Z',
    ].join(' ')
  }

  const from = pointOn(start, PIE_RADIUS)
  const to = pointOn(end, PIE_RADIUS)
  const largeArc = end - start > 0.5 ? 1 : 0

  return [
    `M ${CENTRE} ${CENTRE}`,
    `L ${from.x} ${from.y}`,
    `A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${to.x} ${to.y}`,
    'Z',
  ].join(' ')
}
