import { describe, it, expect } from 'vitest'
import { pointOn, wedgePath, PIE_RADIUS, PIE_SIZE } from './pie-geometry'

const CENTRE = PIE_SIZE / 2

describe('pointOn', () => {
  it('starts at twelve o clock', () => {
    const at = pointOn(0, PIE_RADIUS)
    expect(at.x).toBeCloseTo(CENTRE)
    expect(at.y).toBeCloseTo(CENTRE - PIE_RADIUS)
  })

  it('runs clockwise, so a quarter turn is due east', () => {
    const at = pointOn(0.25, PIE_RADIUS)
    expect(at.x).toBeCloseTo(CENTRE + PIE_RADIUS)
    expect(at.y).toBeCloseTo(CENTRE)
  })

  it('is back at the start after a full turn', () => {
    const start = pointOn(0, PIE_RADIUS)
    const full = pointOn(1, PIE_RADIUS)
    expect(full.x).toBeCloseTo(start.x)
    expect(full.y).toBeCloseTo(start.y)
  })
})

describe('wedgePath', () => {
  it('draws a lone slice as two sweeps rather than a degenerate arc', () => {
    // A single arc from a point back to itself renders as nothing — the classic
    // "100% slice disappears" bug.
    const path = wedgePath(0, 1)
    expect(path.match(/A /g)).toHaveLength(2)
    expect(path).not.toContain('NaN')
  })

  it('does not draw a lone slice through the centre', () => {
    expect(wedgePath(0, 1)).not.toContain(`M ${CENTRE} ${CENTRE}`)
  })

  it('anchors a partial slice at the centre', () => {
    expect(wedgePath(0, 0.25)).toContain(`M ${CENTRE} ${CENTRE}`)
  })

  it('uses the small-arc flag below a half turn', () => {
    expect(wedgePath(0, 0.4)).toContain('0 0 1')
  })

  it('uses the large-arc flag above a half turn', () => {
    expect(wedgePath(0, 0.75)).toContain('0 1 1')
  })

  it('never emits NaN for a sliver', () => {
    expect(wedgePath(0.9999, 1)).not.toContain('NaN')
  })

  it('closes every path', () => {
    expect(wedgePath(0.1, 0.3).endsWith('Z')).toBe(true)
  })
})
