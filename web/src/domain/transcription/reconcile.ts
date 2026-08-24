import { Decimal } from '@/domain/money'
import type { ParsedTranscription } from './types'

export interface Reconciliation {
  /** Sum of the net amounts of every line. */
  linesNet: Decimal
  /** Net total the receipt states about itself, or null if absent. */
  statedNet: Decimal | null
  /** statedNet − linesNet. Positive means lines are missing. */
  difference: Decimal | null
  matches: boolean
}

export function reconcile(transcription: ParsedTranscription): Reconciliation {
  const linesNet = transcription.lines.reduce(
    (sum, line) => sum.plus(line.netAmount),
    new Decimal(0),
  )

  const statedNet = transcription.totals?.net ?? null
  if (statedNet === null) {
    return { linesNet, statedNet: null, difference: null, matches: true }
  }

  const difference = statedNet.minus(linesNet)
  return { linesNet, statedNet, difference, matches: difference.isZero() }
}
