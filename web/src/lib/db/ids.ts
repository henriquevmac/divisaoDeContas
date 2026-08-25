export class InvalidIdError extends Error {
  constructor() {
    super('Not a valid id.')
    this.name = 'InvalidIdError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ids arrive from route parameters and are sometimes interpolated into
 * PostgREST filter strings, where a stray comma or dot changes the query.
 * Row-level security still bounds the damage, but a malformed id should be
 * rejected here rather than producing a confusing database error.
 */
export function assertUuid(value: string): string {
  if (!UUID.test(value)) throw new InvalidIdError()
  return value
}
