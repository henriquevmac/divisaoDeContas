import Link from 'next/link'
import { listReceipts } from '@/lib/db/receipts'
import { Money } from '@/components/Money'

export default async function HomePage() {
  const receipts = await listReceipts()

  return (
    <main className="flex flex-col gap-5 p-4 pb-28">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <Link
          href="/import"
          className="min-h-11 rounded-xl bg-ink px-4 py-2.5 text-sm text-paper"
        >
          Import
        </Link>
      </header>

      <ul className="flex flex-col gap-2">
        {receipts.map((receipt) => (
          <li key={receipt.id}>
            <Link
              href={`/receipts/${receipt.id}`}
              className="flex items-center rounded-xl border border-rule bg-card p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {receipt.merchant || 'Untitled'}
                  {receipt.store && (
                    <span className="text-muted"> · {receipt.store}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  <span className="font-mono tabular-nums">
                    {receipt.purchasedOn}
                  </span>
                  {' · '}
                  {receipt.itemCount} items
                  {receipt.unassignedCount > 0 && (
                    <span className="font-medium text-accent">
                      {' · '}
                      {receipt.unassignedCount} unassigned
                    </span>
                  )}
                </p>
              </div>
              <span className="leader" aria-hidden="true" />
              <Money value={receipt.net} className="shrink-0" />
            </Link>
          </li>
        ))}

        {receipts.length === 0 && (
          <li className="rounded-xl border border-dashed border-rule p-8 text-center">
            <p className="font-medium">No receipts yet</p>
            <p className="mt-1 text-sm text-muted">
              Import a CSV to split your first shop.
            </p>
          </li>
        )}
      </ul>
    </main>
  )
}
