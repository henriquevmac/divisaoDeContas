import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTranscription, TranscriptionParseError } from './parse'

const SAMPLE = readFileSync(
  join(__dirname, 'fixtures/super_bairro_centro_24-08-2026.csv'),
  'utf8',
)

const HEADER =
  'Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido'

describe('parseTranscription on the real sample', () => {
  const result = parseTranscription(SAMPLE)

  it('parses every data row and excludes the TOTAL row', () => {
    expect(result.lines).toHaveLength(34)
  })

  it('reads the stated totals from the TOTAL row', () => {
    expect(result.totals?.gross.toString()).toBe('233.15')
    expect(result.totals?.discount.toString()).toBe('41.93')
    expect(result.totals?.net.toString()).toBe('191.22')
  })

  it('parses the first line in full', () => {
    expect(result.lines[0]).toMatchObject({
      position: 0,
      category: 'MERCEARIA + PET FOOD',
      description: 'ARROZ CAROLINO',
      quantityKind: 'count',
    })
    expect(result.lines[0].quantity.toString()).toBe('3')
    expect(result.lines[0].unitPrice.toString()).toBe('1.15')
    expect(result.lines[0].netAmount.toString()).toBe('3.45')
  })

  it('treats a fractional quantity as a weight', () => {
    const pork = result.lines.find(
      (line) => line.description === 'PORCO BIFANAS/ASSAR',
    )!
    expect(pork.quantityKind).toBe('weight')
    expect(pork.quantity.toString()).toBe('1.532')
    expect(pork.discount.toString()).toBe('0.76')
    expect(pork.netAmount.toString()).toBe('6.88')
  })

  it('treats a trailing-zero quantity as a count', () => {
    const burger = result.lines.find(
      (line) => line.description === 'BOVINO HAMBURG 120G',
    )!
    expect(burger.quantityKind).toBe('count')
    expect(burger.quantity.toString()).toBe('6')
  })

  it('keeps exact duplicate rows as separate lines', () => {
    const burgers = result.lines.filter(
      (line) => line.description === 'BOVINO HAMBURG 120G',
    )
    expect(burgers).toHaveLength(2)
    expect(burgers[0].position).not.toBe(burgers[1].position)
  })

  it('preserves accented descriptions', () => {
    const deposit = result.lines.find((line) => line.category === 'DEPÓSITO VOLTA')
    expect(deposit?.description).toBe('VALOR DEPÓSITO')
  })
})

describe('parseTranscription edge cases', () => {
  it('returns null totals when there is no TOTAL row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50`
    expect(parseTranscription(csv).totals).toBeNull()
  })

  it('ignores blank lines', () => {
    const csv = `${HEADER}\n\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50\n\n`
    expect(parseTranscription(csv).lines).toHaveLength(1)
  })

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const csv = `﻿${HEADER}\r\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50\r\n`
    const parsed = parseTranscription(csv)
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0].category).toBe('BEBIDAS')
  })

  it('rejects a file with no header', () => {
    expect(() => parseTranscription('BEBIDAS;AGUA;1;0,50;0,50;0,00;0,50')).toThrow(
      TranscriptionParseError,
    )
  })

  it('rejects a row with too few columns, naming the row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1`
    expect(() => parseTranscription(csv)).toThrow(/row 2/)
  })

  it('rejects a row with an unparseable amount, naming the row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1;0,50;abc;0,00;0,50`
    expect(() => parseTranscription(csv)).toThrow(/row 2/)
  })

  it('rejects an empty file', () => {
    expect(() => parseTranscription('')).toThrow(TranscriptionParseError)
  })
})
