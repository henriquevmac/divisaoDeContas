'use client'

import { useState } from 'react'
import { TRANSCRIPTION_PROMPT } from '@/domain/transcription/prompt'

/**
 * Shown on the import screen because that is where someone stands when they
 * need it — a receipt in one hand, no idea what to paste into Claude.
 */
export function TranscriptionGuide() {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(TRANSCRIPTION_PROMPT)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      setFailed(true)
    }
  }

  return (
    <details className="rounded-xl border border-rule bg-card">
      <summary className="cursor-pointer list-none p-3.5 font-medium">
        How do I get the CSV?
        <span className="ml-2 text-muted">↓</span>
      </summary>

      <div className="border-t border-rule p-3.5">
        <ol className="flex flex-col gap-2 text-sm">
          <li>
            <span className="eyebrow">Step 1</span>
            <p>Photograph the receipt, flat and in good light.</p>
          </li>
          <li>
            <span className="eyebrow">Step 2</span>
            <p>
              Start a Claude conversation, attach the photo, and paste the
              prompt below.
            </p>
          </li>
          <li>
            <span className="eyebrow">Step 3</span>
            <p>
              Save Claude&rsquo;s reply as a <code>.csv</code> file named{' '}
              <code className="font-mono text-xs">
                merchant_store_DD-MM-YYYY.csv
              </code>{' '}
              — the app reads the shop and date from that name.
            </p>
          </li>
          <li>
            <span className="eyebrow">Step 4</span>
            <p>
              Upload it here. The totals are checked against the receipt before
              anything is saved.
            </p>
          </li>
        </ol>

        <button
          type="button"
          onClick={copy}
          className="mt-4 min-h-11 w-full rounded-xl bg-ink p-3 text-paper"
        >
          {copied ? 'Copied' : 'Copy the prompt'}
        </button>

        {failed && (
          <p className="mt-2 text-xs text-accent">
            Your browser blocked the clipboard. Select the text below and copy
            it by hand.
          </p>
        )}

        <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-paper p-3 font-mono text-xs whitespace-pre-wrap">
          {TRANSCRIPTION_PROMPT}
        </pre>
      </div>
    </details>
  )
}
