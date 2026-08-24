import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTranscription } from './parse'
import { reconcile } from './reconcile'

const SAMPLE = readFileSync(
  join(__dirname, 'fixtures/super_bairro_centro_24-08-2026.csv'),
  'utf8',
)

describe('reconcile', () => {
  it('matches on the real sample', () => {
    const result = reconcile(parseTranscription(SAMPLE))
    expect(result.statedNet?.toString()).toBe('191.22')
    expect(result.linesNet.toString()).toBe('191.22')
    expect(result.difference?.toString()).toBe('0')
    expect(result.matches).toBe(true)
  })

  it('reports the shortfall when a line is missing', () => {
    const parsed = parseTranscription(SAMPLE)
    parsed.lines.pop()
    const result = reconcile(parsed)
    expect(result.matches).toBe(false)
    expect(result.difference?.toString()).toBe('0.1')
  })

  it('matches trivially when there are no stated totals', () => {
    const result = reconcile({ lines: [], totals: null })
    expect(result.statedNet).toBeNull()
    expect(result.difference).toBeNull()
    expect(result.matches).toBe(true)
  })
})
