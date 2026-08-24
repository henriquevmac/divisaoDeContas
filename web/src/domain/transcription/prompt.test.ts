import { describe, it, expect } from 'vitest'
import { TRANSCRIPTION_PROMPT, CSV_HEADER } from './prompt'
import { parseTranscription } from './parse'

/**
 * The prompt tells a model what to produce; the parser decides what it accepts.
 * These tests fail if the two ever describe different formats.
 */
describe('the transcription prompt matches the parser', () => {
  it('asks for the header the parser expects', () => {
    expect(TRANSCRIPTION_PROMPT).toContain(CSV_HEADER)
  })

  it('produces a CSV the parser accepts', () => {
    const csv = [
      CSV_HEADER,
      'BEBIDAS;CERVEJA LOIRA 30X25CL;3;14,95;44,85;0,00;44,85',
      'TALHO;PORCO BIFANAS/ASSAR;1,532;4,99;7,64;0,76;6,88',
      ';TOTAL;;;52,49;0,76;51,73',
    ].join('\n')

    const parsed = parseTranscription(csv)
    expect(parsed.lines).toHaveLength(2)
    expect(parsed.lines[0].quantityKind).toBe('count')
    expect(parsed.lines[1].quantityKind).toBe('weight')
    expect(parsed.totals?.net.toString()).toBe('51.73')
  })

  it('documents the decimal comma, which the parser requires', () => {
    expect(TRANSCRIPTION_PROMPT).toMatch(/comma as the decimal separator/i)
  })

  it('tells the model not to merge duplicate rows', () => {
    expect(TRANSCRIPTION_PROMPT).toMatch(/never merge/i)
  })

  it('asks for the TOTAL row the reconciliation depends on', () => {
    expect(TRANSCRIPTION_PROMPT).toContain(';TOTAL;;;')
  })
})
