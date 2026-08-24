import { notFound } from 'next/navigation'
import { getReceipt } from '@/lib/db/receipts'
import { listPeople } from '@/lib/db/people'
import { ReceiptScreen } from './ReceiptScreen'

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [loaded, people] = await Promise.all([getReceipt(id), listPeople()])
  if (!loaded) notFound()

  return (
    <ReceiptScreen
      receipt={loaded.receipt}
      items={loaded.items}
      people={people}
    />
  )
}
