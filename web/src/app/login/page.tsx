'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')

  async function sendLink(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')

    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('sent')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      <div>
        <p className="eyebrow">Divisão de</p>
        <h1 className="text-4xl font-semibold tracking-tight">Contas</h1>
        <p className="mt-3 text-sm text-muted">
          Split a shopping receipt between people.
        </p>
      </div>

      {status === 'sent' ? (
        <p className="rounded-xl border border-rule bg-good-soft p-4 text-good">
          Sign-in link sent to {email}. Open it on this device.
        </p>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-h-12 rounded-xl border border-rule bg-card p-3 text-base focus:border-ink"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="min-h-12 rounded-xl bg-ink p-3 text-paper disabled:opacity-40"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && (
            <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
              {message}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
