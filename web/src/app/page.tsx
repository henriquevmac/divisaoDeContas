import Link from 'next/link'
import { listReceipts } from '@/lib/db/receipts'
import { Money } from '@/components/Money'

export default async function HomePage() {
  const receipts = await listReceipts()

  return (
    <main className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Receipts</h1>
        <Link href="/import" className="rounded-lg bg-black px-4 py-2 text-white">
          Import
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {receipts.map((receipt) => (
          <li key={receipt.id}>
            <Link
              href={`/receipts/${receipt.id}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {receipt.merchant} {receipt.store && `· ${receipt.store}`}
                </p>
                <p className="text-xs text-neutral-500">
                  {receipt.purchasedOn} · {receipt.itemCount} items
                  {receipt.unassignedCount > 0 && (
                    <span className="ml-1 font-medium text-red-700">
                      · {receipt.unassignedCount} unassigned
                    </span>
                  )}
                </p>
              </div>
              <Money value={receipt.net} />
            </Link>
          </li>
        ))}
        {receipts.length === 0 && (
          <li className="rounded-lg border border-dashed p-6 text-center text-neutral-500">
            No receipts yet. Import a CSV to get started.
          </li>
        )}
      </ul>
    </main>
  )
}
