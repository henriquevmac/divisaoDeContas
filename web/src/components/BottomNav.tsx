'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDDEN_ON = ['/login', '/auth']

export function BottomNav() {
  const pathname = usePathname()
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-white">
      <Link href="/" className="flex-1 p-4 text-center">
        Receipts
      </Link>
      <Link href="/people" className="flex-1 p-4 text-center">
        People
      </Link>
      <Link href="/import" className="flex-1 p-4 text-center">
        Import
      </Link>
    </nav>
  )
}
