import { describe, it, expect } from 'vitest'
import { assertUuid, InvalidIdError } from './ids'

describe('assertUuid', () => {
  it('accepts a real uuid', () => {
    const id = 'fe8f6d89-ce19-4556-8899-1082c584c877'
    expect(assertUuid(id)).toBe(id)
  })

  it('accepts uppercase', () => {
    expect(() => assertUuid('FE8F6D89-CE19-4556-8899-1082C584C877')).not.toThrow()
  })

  it('rejects a value carrying PostgREST filter syntax', () => {
    // The reason this exists: ids are interpolated into .or() filter strings.
    expect(() => assertUuid('x,person_id.neq.null')).toThrow(InvalidIdError)
  })

  it('rejects an empty string', () => {
    expect(() => assertUuid('')).toThrow(InvalidIdError)
  })

  it('rejects a truncated uuid', () => {
    expect(() => assertUuid('fe8f6d89-ce19-4556-8899')).toThrow(InvalidIdError)
  })
})
