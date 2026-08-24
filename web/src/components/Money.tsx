import { formatEuro, type Decimal } from '@/domain/money'

/** Money is always mono and tabular, so columns of figures line up. */
export function Money({ value, className }: { value: Decimal; className?: string }) {
  return (
    <span className={`font-mono tabular-nums ${className ?? ''}`}>
      {formatEuro(value)}
    </span>
  )
}
