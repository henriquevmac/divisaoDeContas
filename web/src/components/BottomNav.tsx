'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDDEN_ON = ['/login', '/auth']

const LINKS = [
  { href: '/', label: 'Receipts' },
  { href: '/people', label: 'People' },
  { href: '/stats', label: 'Stats' },
  { href: '/import', label: 'Import' },
]

export function BottomNav() {
  const pathname = usePathname()
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-rule bg-card pb-[env(safe-area-inset-bottom)]">
      {LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 border-t-2 p-4 text-center text-sm ${
              active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
