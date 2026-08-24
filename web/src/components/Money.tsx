import { formatEuro, type Decimal } from '@/domain/money'

export function Money({ value, className }: { value: Decimal; className?: string }) {
  return <span className={`tabular-nums ${className ?? ''}`}>{formatEuro(value)}</span>
}
