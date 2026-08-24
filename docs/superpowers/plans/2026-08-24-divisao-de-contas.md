# Divisão de Contas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user mobile web app that imports a CSV transcription of a shopping receipt, verifies it, and divides its items among people with tracked balances.

**Architecture:** All domain logic — CSV parsing, reconciliation, exploding, share and balance arithmetic — lives in `src/domain/` as pure, dependency-free functions covered by Vitest. The Next.js App Router layer is a thin shell that calls those functions and persists results to Supabase Postgres through Server Actions. Parsing runs client-side and produces a draft that only reaches the database when the user confirms verification.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, Supabase (Postgres + magic-link auth + RLS), decimal.js, Vitest, Vercel.

**Spec:** [`docs/spec.md`](../../spec.md) — read it, along with [`CONTEXT.md`](../../../CONTEXT.md) for vocabulary and [`docs/adr/`](../../adr/) for decisions already made.

## Global Constraints

- **Money is never a JS `number`.** Every monetary value is a `decimal.js` `Decimal` in TypeScript and a `NUMERIC` column in Postgres. A float anywhere in the money path is a defect.
- **Displayed shares are permitted not to sum to the item total.** ADR-0002 accepts this. Do not add largest-remainder allocation, do not "correct" a cent.
- **Vocabulary is fixed by `CONTEXT.md`.** Use `Receipt`, `Item`, `Person`, `Assignment`, `Share`, `Settlement`, `Transcription`, `Explode`. Do not introduce `user`, `bill`, `product`, `payment`, or `split` (as a noun for cost division).
- **Locale is `pt-PT`, currency EUR.** Decimal comma on input and output.
- **The database is written to only on explicit user confirmation.** Import and parsing never touch it.
- **No model/LLM API inside the app.** ADR-0001.
- Node 20+. Package manager: `npm`.
- **Next.js 16, not 15.** `middleware.ts` is deprecated and renamed to
  `proxy.ts`, exporting a function named `proxy` rather than `middleware`; with
  `--src-dir` it belongs at `web/src/proxy.ts`. `params` is a `Promise` and
  `cookies()` must be awaited, both as this plan already has them. Before
  writing app-layer code, consult `web/node_modules/next/dist/docs/` rather than
  relying on Next 15 habits.
- **Repository layout.** The Next.js app lives in `web/`, not at the repository
  root, because `create-next-app` refuses to scaffold into a non-empty directory
  and the root already holds `CONTEXT.md`, `docs/` and the sample CSV. Every
  `src/...` and `middleware.ts` path in this plan is relative to `web/`; run all
  `npm` commands from there. Paths that stay at the repository root:
  `CONTEXT.md`, `docs/`, `supabase/`, `README.md`, `.gitignore`, and the sample
  `*.csv`. Vercel's Root Directory setting must be `web`.
- Every task ends with a commit. Conventional Commits (`feat:`, `test:`, `chore:`).

---

## File Structure

**Domain (pure, no I/O, fully unit-tested)**
- `src/domain/money.ts` — parse and format Portuguese decimals; `Decimal` re-export.
- `src/domain/transcription/types.ts` — `TranscriptionLine`, `TranscriptionTotals`, `ParsedTranscription`.
- `src/domain/transcription/parse.ts` — CSV text → `ParsedTranscription`.
- `src/domain/transcription/filename.ts` — filename → receipt metadata.
- `src/domain/transcription/reconcile.ts` — line sum vs stated total.
- `src/domain/items.ts` — `DraftItem`, `canExplode`, `explode`.
- `src/domain/shares.ts` — shares, per-receipt totals, balances.

**Persistence**
- `supabase/migrations/0001_initial_schema.sql` — tables, indexes, RLS.
- `src/lib/supabase/client.ts` — browser client.
- `src/lib/supabase/server.ts` — server client bound to request cookies.
- `src/lib/db/types.ts` — row types and `Decimal` mapping helpers.
- `src/lib/db/receipts.ts` — receipt + item reads and the transactional save.
- `src/lib/db/people.ts` — people and settlements.
- `src/lib/db/assignments.ts` — assignment reads and bulk writes.

**App**
- `src/app/layout.tsx`, `src/app/globals.css`
- `src/app/login/page.tsx` — magic link form.
- `src/app/auth/callback/route.ts` — code exchange.
- `middleware.ts` — session refresh + route protection.
- `src/app/page.tsx` — receipt list.
- `src/app/import/page.tsx` — upload + verification screen.
- `src/app/import/actions.ts` — `saveVerifiedReceipt` server action.
- `src/app/receipts/[id]/page.tsx` — items, assignment, per-person totals.
- `src/app/receipts/[id]/actions.ts` — assignment and explode server actions.
- `src/app/people/page.tsx` — people list with balances.
- `src/app/people/[id]/page.tsx` — one person's shares and settlements.
- `src/app/people/actions.ts` — people CRUD and settlements.

**Components**
- `src/components/Money.tsx` — formats a `Decimal` for display.
- `src/components/VerificationTable.tsx` — editable line table.
- `src/components/ItemAssignmentList.tsx` — selectable, category-grouped item list.
- `src/components/AssignSheet.tsx` — bottom sheet to pick people.

---

## Task 1: Project scaffold and test harness

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/vitest.config.ts`, `web/.env.local.example`, root `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/domain/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest) and `npm run dev` (Next.js); the `src/domain/` and `src/app/` roots every later task builds into.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

`web/` does not exist yet, so the generator creates it cleanly and the repository root is left untouched. Every later command in this plan runs from `web/` unless it touches `supabase/`, `docs/` or `README.md`.

- [ ] **Step 2: Install runtime and test dependencies**

```bash
npm install decimal.js @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `src/domain/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

describe('test harness', () => {
  it('runs and has decimal.js available', () => {
    expect(new Decimal('0.1').plus('0.2').toString()).toBe('0.3')
  })
})
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: PASS, 1 test. (Note it also demonstrates why we use `Decimal`: `0.1 + 0.2` as floats is `0.30000000000000004`.)

- [ ] **Step 6: Verify the dev server boots**

Run: `npm run dev`
Expected: server listening on `http://localhost:3000` with no compile errors. Stop it again.

- [ ] **Step 7: Record required environment variables**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Confirm `.gitignore` contains `.env*.local`.

- [ ] **Step 8: Commit**

Run from the repository root, so `CONTEXT.md`, `docs/` and `web/` are all captured:

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and decimal.js"
```

---

## Task 2: Money primitives

Portuguese receipts write `1.234,56`. Every number that enters the app from a Transcription passes through here, and every number shown to a human leaves through here.

**Files:**
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`
- Delete: `src/domain/smoke.test.ts`

**Interfaces:**
- Consumes: `decimal.js`.
- Produces:
  - `parsePtDecimal(input: string): Decimal` — throws `MoneyParseError` on junk.
  - `formatEuro(value: Decimal): string` — `"1 234,56 €"` per `pt-PT`.
  - `formatQuantity(value: Decimal): string` — `"3"` for counts, `"1,532"` for weights.
  - `isWholeNumber(value: Decimal): boolean`
  - `class MoneyParseError extends Error`
  - re-export `Decimal`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parsePtDecimal,
  formatEuro,
  formatQuantity,
  isWholeNumber,
  MoneyParseError,
} from './money'

describe('parsePtDecimal', () => {
  it('parses a decimal comma', () => {
    expect(parsePtDecimal('1,15').toString()).toBe('1.15')
  })

  it('parses a thousands separator', () => {
    expect(parsePtDecimal('1.234,56').toString()).toBe('1234.56')
  })

  it('parses an integer', () => {
    expect(parsePtDecimal('3').toString()).toBe('3')
  })

  it('parses a three-decimal weight', () => {
    expect(parsePtDecimal('1,532').toString()).toBe('1.532')
  })

  it('parses zero', () => {
    expect(parsePtDecimal('0,00').toString()).toBe('0')
  })

  it('trims surrounding whitespace', () => {
    expect(parsePtDecimal('  2,50  ').toString()).toBe('2.5')
  })

  it('rejects an empty string', () => {
    expect(() => parsePtDecimal('')).toThrow(MoneyParseError)
  })

  it('rejects non-numeric text', () => {
    expect(() => parsePtDecimal('TOTAL')).toThrow(MoneyParseError)
  })
})

describe('formatEuro', () => {
  it('formats with a decimal comma and two places', () => {
    // Non-breaking spaces vary by ICU build, so normalise whitespace.
    const formatted = formatEuro(parsePtDecimal('191,22')).replace(/\s/g, ' ')
    expect(formatted).toBe('191,22 €')
  })

  it('rounds a repeating share to two places', () => {
    const third = parsePtDecimal('10,00').dividedBy(3)
    expect(formatEuro(third).replace(/\s/g, ' ')).toBe('3,33 €')
  })
})

describe('formatQuantity', () => {
  it('shows a whole number without decimals', () => {
    expect(formatQuantity(parsePtDecimal('6,000'))).toBe('6')
  })

  it('shows a weight with three decimals', () => {
    expect(formatQuantity(parsePtDecimal('1,532'))).toBe('1,532')
  })
})

describe('isWholeNumber', () => {
  it('is true for 6,000', () => {
    expect(isWholeNumber(parsePtDecimal('6,000'))).toBe(true)
  })

  it('is false for 0,436', () => {
    expect(isWholeNumber(parsePtDecimal('0,436'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/domain/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement**

Create `src/domain/money.ts`:

```ts
import Decimal from 'decimal.js'

export { Decimal }

export class MoneyParseError extends Error {
  constructor(input: string) {
    super(`Not a valid Portuguese decimal: ${JSON.stringify(input)}`)
    this.name = 'MoneyParseError'
  }
}

/**
 * Parses Portuguese number notation: "." groups thousands, "," is the decimal
 * separator. Returns an exact Decimal — never a float.
 */
export function parsePtDecimal(input: string): Decimal {
  const trimmed = input.trim()
  if (trimmed === '') throw new MoneyParseError(input)

  const normalised = trimmed.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) throw new MoneyParseError(input)

  return new Decimal(normalised)
}

const euroFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

/** Rounds to the cent for display only. Stored values stay exact (ADR-0002). */
export function formatEuro(value: Decimal): string {
  return euroFormatter.format(value.toDecimalPlaces(2).toNumber())
}

export function isWholeNumber(value: Decimal): boolean {
  return value.isInteger()
}

export function formatQuantity(value: Decimal): string {
  if (isWholeNumber(value)) return value.toFixed(0)
  return value.toFixed(3).replace('.', ',')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/domain/money.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Remove the smoke test and re-run everything**

```bash
rm src/domain/smoke.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat: add Portuguese decimal parsing and euro formatting"
```

---

## Task 3: Transcription parser

The heart of ADR-0001. Deterministic, pure, and tested against the real sample file.

**Files:**
- Create: `src/domain/transcription/types.ts`
- Create: `src/domain/transcription/parse.ts`
- Create: `src/domain/transcription/fixtures/super_bairro_centro_24-08-2026.csv` (copy of the sample at the repo root)
- Test: `src/domain/transcription/parse.test.ts`

**Interfaces:**
- Consumes: `parsePtDecimal`, `isWholeNumber`, `Decimal` from `@/domain/money`.
- Produces:
  - `type QuantityKind = 'count' | 'weight'`
  - `interface TranscriptionLine { position: number; category: string; description: string; quantity: Decimal; quantityKind: QuantityKind; unitPrice: Decimal; grossAmount: Decimal; discount: Decimal; netAmount: Decimal }`
  - `interface TranscriptionTotals { gross: Decimal; discount: Decimal; net: Decimal }`
  - `interface ParsedTranscription { lines: TranscriptionLine[]; totals: TranscriptionTotals | null }`
  - `parseTranscription(csv: string): ParsedTranscription`
  - `class TranscriptionParseError extends Error` with a `.row` number.

- [ ] **Step 1: Copy the sample receipt in as a test fixture**

```bash
mkdir -p web/src/domain/transcription/fixtures
cp super_bairro_centro_24-08-2026.csv web/src/domain/transcription/fixtures/
```

Run this one from the repository root — the sample CSV lives there, not in `web/`.

- [ ] **Step 2: Write the types**

Create `src/domain/transcription/types.ts`:

```ts
import type { Decimal } from '@/domain/money'

export type QuantityKind = 'count' | 'weight'

export interface TranscriptionLine {
  /** Zero-based position in the file, used to keep duplicate rows distinct. */
  position: number
  category: string
  description: string
  quantity: Decimal
  quantityKind: QuantityKind
  unitPrice: Decimal
  grossAmount: Decimal
  discount: Decimal
  netAmount: Decimal
}

export interface TranscriptionTotals {
  gross: Decimal
  discount: Decimal
  net: Decimal
}

export interface ParsedTranscription {
  lines: TranscriptionLine[]
  /** Null when the file has no TOTAL row — reconciliation is then skipped. */
  totals: TranscriptionTotals | null
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/domain/transcription/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTranscription, TranscriptionParseError } from './parse'

const SAMPLE = readFileSync(
  join(__dirname, 'fixtures/super_bairro_centro_24-08-2026.csv'),
  'utf8',
)

const HEADER =
  'Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido'

describe('parseTranscription on the real sample', () => {
  const result = parseTranscription(SAMPLE)

  it('parses every data row and excludes the TOTAL row', () => {
    expect(result.lines).toHaveLength(34)
  })

  it('reads the stated totals from the TOTAL row', () => {
    expect(result.totals?.gross.toString()).toBe('233.15')
    expect(result.totals?.discount.toString()).toBe('41.93')
    expect(result.totals?.net.toString()).toBe('191.22')
  })

  it('parses the first line in full', () => {
    expect(result.lines[0]).toMatchObject({
      position: 0,
      category: 'MERCEARIA + PET FOOD',
      description: 'ARROZ CAROLINO',
      quantityKind: 'count',
    })
    expect(result.lines[0].quantity.toString()).toBe('3')
    expect(result.lines[0].unitPrice.toString()).toBe('1.15')
    expect(result.lines[0].netAmount.toString()).toBe('3.45')
  })

  it('treats a fractional quantity as a weight', () => {
    const pork = result.lines.find(
      (line) => line.description === 'PORCO BIFANAS/ASSAR',
    )!
    expect(pork.quantityKind).toBe('weight')
    expect(pork.quantity.toString()).toBe('1.532')
    expect(pork.discount.toString()).toBe('0.76')
    expect(pork.netAmount.toString()).toBe('6.88')
  })

  it('treats a trailing-zero quantity as a count', () => {
    const burger = result.lines.find(
      (line) => line.description === 'BOVINO HAMBURG 120G',
    )!
    expect(burger.quantityKind).toBe('count')
    expect(burger.quantity.toString()).toBe('6')
  })

  it('keeps exact duplicate rows as separate lines', () => {
    const burgers = result.lines.filter(
      (line) => line.description === 'BOVINO HAMBURG 120G',
    )
    expect(burgers).toHaveLength(2)
    expect(burgers[0].position).not.toBe(burgers[1].position)
  })

  it('preserves accented descriptions', () => {
    const deposit = result.lines.find((line) => line.category === 'DEPÓSITO VOLTA')
    expect(deposit?.description).toBe('VALOR DEPÓSITO')
  })
})

describe('parseTranscription edge cases', () => {
  it('returns null totals when there is no TOTAL row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50`
    expect(parseTranscription(csv).totals).toBeNull()
  })

  it('ignores blank lines', () => {
    const csv = `${HEADER}\n\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50\n\n`
    expect(parseTranscription(csv).lines).toHaveLength(1)
  })

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const csv = `﻿${HEADER}\r\nBEBIDAS;AGUA;1;0,50;0,50;0,00;0,50\r\n`
    const parsed = parseTranscription(csv)
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0].category).toBe('BEBIDAS')
  })

  it('rejects a file with no header', () => {
    expect(() => parseTranscription('BEBIDAS;AGUA;1;0,50;0,50;0,00;0,50')).toThrow(
      TranscriptionParseError,
    )
  })

  it('rejects a row with too few columns, naming the row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1`
    expect(() => parseTranscription(csv)).toThrow(/row 2/)
  })

  it('rejects a row with an unparseable amount, naming the row', () => {
    const csv = `${HEADER}\nBEBIDAS;AGUA;1;0,50;abc;0,00;0,50`
    expect(() => parseTranscription(csv)).toThrow(/row 2/)
  })

  it('rejects an empty file', () => {
    expect(() => parseTranscription('')).toThrow(TranscriptionParseError)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- src/domain/transcription/parse.test.ts`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 5: Implement the parser**

Create `src/domain/transcription/parse.ts`:

```ts
import { parsePtDecimal, isWholeNumber, MoneyParseError } from '@/domain/money'
import type {
  ParsedTranscription,
  TranscriptionLine,
  TranscriptionTotals,
} from './types'

export class TranscriptionParseError extends Error {
  /** One-based row number as a human counts lines in the file. */
  readonly row: number

  constructor(row: number, detail: string) {
    super(`Could not read row ${row}: ${detail}`)
    this.name = 'TranscriptionParseError'
    this.row = row
  }
}

const COLUMN_COUNT = 7
const TOTAL_MARKER = 'TOTAL'

function splitRows(csv: string): string[] {
  return csv.replace(/^﻿/, '').split(/\r?\n/)
}

function looksLikeHeader(row: string): boolean {
  return row.toLowerCase().startsWith('categoria;')
}

export function parseTranscription(csv: string): ParsedTranscription {
  const rows = splitRows(csv)
  const firstNonBlank = rows.findIndex((row) => row.trim() !== '')

  if (firstNonBlank === -1) {
    throw new TranscriptionParseError(1, 'the file is empty')
  }
  if (!looksLikeHeader(rows[firstNonBlank])) {
    throw new TranscriptionParseError(
      firstNonBlank + 1,
      'expected the header row starting with "Categoria;"',
    )
  }

  const lines: TranscriptionLine[] = []
  let totals: TranscriptionTotals | null = null

  for (let index = firstNonBlank + 1; index < rows.length; index += 1) {
    const raw = rows[index]
    if (raw.trim() === '') continue

    const rowNumber = index + 1
    const cells = raw.split(';').map((cell) => cell.trim())

    if (cells.length !== COLUMN_COUNT) {
      throw new TranscriptionParseError(
        rowNumber,
        `expected ${COLUMN_COUNT} columns, found ${cells.length}`,
      )
    }

    const [category, description, quantity, unitPrice, gross, discount, net] =
      cells

    try {
      if (description.toUpperCase() === TOTAL_MARKER) {
        totals = {
          gross: parsePtDecimal(gross),
          discount: parsePtDecimal(discount),
          net: parsePtDecimal(net),
        }
        continue
      }

      const parsedQuantity = parsePtDecimal(quantity)
      lines.push({
        position: lines.length,
        category,
        description,
        quantity: parsedQuantity,
        quantityKind: isWholeNumber(parsedQuantity) ? 'count' : 'weight',
        unitPrice: parsePtDecimal(unitPrice),
        grossAmount: parsePtDecimal(gross),
        discount: parsePtDecimal(discount),
        netAmount: parsePtDecimal(net),
      })
    } catch (error) {
      if (error instanceof MoneyParseError) {
        throw new TranscriptionParseError(rowNumber, error.message)
      }
      throw error
    }
  }

  return { lines, totals }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/domain/transcription/parse.test.ts`
Expected: PASS, 14 tests. If the sample-row count assertion fails, count the data rows in the fixture (`wc -l` minus the header and the TOTAL row) and correct the expectation — the fixture is the source of truth, not the number written here.

- [ ] **Step 7: Commit**

```bash
git add src/domain/transcription
git commit -m "feat: parse CSV transcriptions into lines and stated totals"
```

---

## Task 4: Filename metadata and reconciliation

Two small pure functions that complete the import pipeline.

**Files:**
- Create: `src/domain/transcription/filename.ts`
- Create: `src/domain/transcription/reconcile.ts`
- Test: `src/domain/transcription/filename.test.ts`
- Test: `src/domain/transcription/reconcile.test.ts`

**Interfaces:**
- Consumes: `Decimal` from `@/domain/money`; `ParsedTranscription` from `./types`.
- Produces:
  - `interface ReceiptMetadata { merchant: string; store: string; purchasedOn: string }` — `purchasedOn` is `YYYY-MM-DD`, and any field may be `''` when the filename does not match.
  - `parseReceiptFilename(filename: string): ReceiptMetadata`
  - `interface Reconciliation { linesNet: Decimal; statedNet: Decimal | null; difference: Decimal | null; matches: boolean }`
  - `reconcile(transcription: ParsedTranscription): Reconciliation`

- [ ] **Step 1: Write the failing filename tests**

Create `src/domain/transcription/filename.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseReceiptFilename } from './filename'

describe('parseReceiptFilename', () => {
  it('parses the sample filename', () => {
    expect(parseReceiptFilename('super_bairro_centro_24-08-2026.csv')).toEqual({
      merchant: 'Super Bairro',
      store: 'Centro',
      purchasedOn: '2026-08-24',
    })
  })

  it('handles a single-word merchant', () => {
    expect(parseReceiptFilename('continente_leiria_01-01-2026.csv')).toEqual({
      merchant: 'Continente',
      store: 'Leiria',
      purchasedOn: '2026-01-01',
    })
  })

  it('ignores a leading path', () => {
    expect(
      parseReceiptFilename('/home/me/super_bairro_centro_24-08-2026.csv').merchant,
    ).toBe('Super Bairro')
  })

  it('returns blank fields for a non-matching filename', () => {
    expect(parseReceiptFilename('receipt.csv')).toEqual({
      merchant: '',
      store: '',
      purchasedOn: '',
    })
  })

  it('returns blank fields when the date is impossible', () => {
    expect(parseReceiptFilename('lidl_porto_32-13-2026.csv')).toEqual({
      merchant: '',
      store: '',
      purchasedOn: '',
    })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/transcription/filename.test.ts`
Expected: FAIL — cannot resolve `./filename`.

- [ ] **Step 3: Implement the filename parser**

Create `src/domain/transcription/filename.ts`:

```ts
export interface ReceiptMetadata {
  merchant: string
  store: string
  /** ISO date, YYYY-MM-DD. Empty when the filename did not carry one. */
  purchasedOn: string
}

const BLANK: ReceiptMetadata = { merchant: '', store: '', purchasedOn: '' }

const PATTERN = /^(.+)_([^_]+)_(\d{2})-(\d{2})-(\d{4})$/

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Best-effort read of `<merchant>_<store>_<DD-MM-YYYY>.csv`. A filename that
 * does not match is not an error — the user fills the fields in by hand.
 */
export function parseReceiptFilename(filename: string): ReceiptMetadata {
  const base = filename.split('/').pop() ?? filename
  const stem = base.replace(/\.csv$/i, '')

  const match = PATTERN.exec(stem)
  if (!match) return { ...BLANK }

  const [, merchantPart, storePart, day, month, year] = match
  if (!isRealDate(Number(year), Number(month), Number(day))) return { ...BLANK }

  return {
    merchant: titleCase(merchantPart),
    store: titleCase(storePart),
    purchasedOn: `${year}-${month}-${day}`,
  }
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- src/domain/transcription/filename.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing reconciliation tests**

Create `src/domain/transcription/reconcile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTranscription } from './parse'
import { reconcile } from './reconcile'

const SAMPLE = readFileSync(
  join(__dirname, 'fixtures/super_bairro_centro_24-08-2026.csv'),
  'utf8',
)

describe('reconcile', () => {
  it('matches on the real sample', () => {
    const result = reconcile(parseTranscription(SAMPLE))
    expect(result.statedNet?.toString()).toBe('191.22')
    expect(result.linesNet.toString()).toBe('191.22')
    expect(result.difference?.toString()).toBe('0')
    expect(result.matches).toBe(true)
  })

  it('reports the shortfall when a line is missing', () => {
    const parsed = parseTranscription(SAMPLE)
    parsed.lines.pop()
    const result = reconcile(parsed)
    expect(result.matches).toBe(false)
    expect(result.difference?.toString()).toBe('0.1')
  })

  it('matches trivially when there are no stated totals', () => {
    const result = reconcile({ lines: [], totals: null })
    expect(result.statedNet).toBeNull()
    expect(result.difference).toBeNull()
    expect(result.matches).toBe(true)
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/domain/transcription/reconcile.test.ts`
Expected: FAIL — cannot resolve `./reconcile`.

- [ ] **Step 7: Implement reconciliation**

Create `src/domain/transcription/reconcile.ts`:

```ts
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
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/domain/transcription
git commit -m "feat: parse receipt metadata from filenames and reconcile totals"
```

---

## Task 5: Draft items and Explode

`DraftItem` is the shape shared by the verification screen and the database — one thing on a Receipt, whether or not it has been saved yet.

**Files:**
- Create: `src/domain/items.ts`
- Test: `src/domain/items.test.ts`

**Interfaces:**
- Consumes: `Decimal`, `isWholeNumber` from `@/domain/money`; `TranscriptionLine`, `QuantityKind` from `@/domain/transcription/types`.
- Produces:
  - `interface DraftItem { key: string; category: string; description: string; quantity: Decimal; quantityKind: QuantityKind; unitPrice: Decimal; grossAmount: Decimal; discount: Decimal; netAmount: Decimal }`
  - `draftItemsFromLines(lines: TranscriptionLine[]): DraftItem[]`
  - `canExplode(item: DraftItem): boolean`
  - `explode(item: DraftItem): DraftItem[]`

`key` is a stable client-side identifier used by React and by selection state; it is not the database id.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/items.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePtDecimal } from './money'
import { canExplode, explode, draftItemsFromLines, type DraftItem } from './items'
import type { TranscriptionLine } from './transcription/types'

function item(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    key: 'k1',
    category: 'BEBIDAS',
    description: 'CERVEJA LOIRA 30X25CL',
    quantity: parsePtDecimal('3'),
    quantityKind: 'count',
    unitPrice: parsePtDecimal('14,95'),
    grossAmount: parsePtDecimal('44,85'),
    discount: parsePtDecimal('0,00'),
    netAmount: parsePtDecimal('44,85'),
    ...overrides,
  }
}

describe('canExplode', () => {
  it('allows a count greater than one', () => {
    expect(canExplode(item())).toBe(true)
  })

  it('refuses a quantity of one', () => {
    expect(canExplode(item({ quantity: parsePtDecimal('1') }))).toBe(false)
  })

  it('refuses a weight', () => {
    expect(
      canExplode(
        item({ quantity: parsePtDecimal('1,532'), quantityKind: 'weight' }),
      ),
    ).toBe(false)
  })
})

describe('explode', () => {
  it('produces one item per unit', () => {
    expect(explode(item())).toHaveLength(3)
  })

  it('divides gross, discount and net evenly', () => {
    const parts = explode(
      item({
        description: 'WRAPS TRIGO 6UN',
        quantity: parsePtDecimal('3'),
        unitPrice: parsePtDecimal('2,49'),
        grossAmount: parsePtDecimal('7,47'),
        discount: parsePtDecimal('1,50'),
        netAmount: parsePtDecimal('5,97'),
      }),
    )
    expect(parts.map((part) => part.netAmount.toString())).toEqual([
      '1.99',
      '1.99',
      '1.99',
    ])
    expect(parts[0].grossAmount.toString()).toBe('2.49')
    expect(parts[0].discount.toString()).toBe('0.5')
  })

  it('sets every part to quantity one and keeps the unit price', () => {
    const parts = explode(item())
    expect(parts.every((part) => part.quantity.equals(1))).toBe(true)
    expect(parts[0].unitPrice.toString()).toBe('14.95')
  })

  it('gives every part a distinct key', () => {
    const keys = explode(item()).map((part) => part.key)
    expect(new Set(keys).size).toBe(3)
  })

  it('carries category and description through unchanged', () => {
    const parts = explode(item())
    expect(parts[0].category).toBe('BEBIDAS')
    expect(parts[0].description).toBe('CERVEJA LOIRA 30X25CL')
  })

  it('returns the item untouched when it cannot be exploded', () => {
    const single = item({ quantity: parsePtDecimal('1') })
    expect(explode(single)).toEqual([single])
  })
})

describe('draftItemsFromLines', () => {
  it('gives duplicate lines distinct keys', () => {
    const line: Omit<TranscriptionLine, 'position'> = {
      category: 'TALHO',
      description: 'BOVINO HAMBURG 120G',
      quantity: parsePtDecimal('6'),
      quantityKind: 'count',
      unitPrice: parsePtDecimal('1,38'),
      grossAmount: parsePtDecimal('8,28'),
      discount: parsePtDecimal('0,00'),
      netAmount: parsePtDecimal('8,28'),
    }
    const items = draftItemsFromLines([
      { ...line, position: 0 },
      { ...line, position: 1 },
    ])
    expect(items).toHaveLength(2)
    expect(items[0].key).not.toBe(items[1].key)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/items.test.ts`
Expected: FAIL — cannot resolve `./items`.

- [ ] **Step 3: Implement**

Create `src/domain/items.ts`:

```ts
import { Decimal, isWholeNumber } from './money'
import type { QuantityKind, TranscriptionLine } from './transcription/types'

export interface DraftItem {
  /** Stable client-side identity for React keys and selection. Not a DB id. */
  key: string
  category: string
  description: string
  quantity: Decimal
  quantityKind: QuantityKind
  unitPrice: Decimal
  grossAmount: Decimal
  discount: Decimal
  netAmount: Decimal
}

let keyCounter = 0

export function nextItemKey(): string {
  keyCounter += 1
  return `item-${keyCounter}`
}

export function draftItemsFromLines(lines: TranscriptionLine[]): DraftItem[] {
  return lines.map((line) => ({
    key: nextItemKey(),
    category: line.category,
    description: line.description,
    quantity: line.quantity,
    quantityKind: line.quantityKind,
    unitPrice: line.unitPrice,
    grossAmount: line.grossAmount,
    discount: line.discount,
    netAmount: line.netAmount,
  }))
}

export function canExplode(item: DraftItem): boolean {
  return (
    item.quantityKind === 'count' &&
    isWholeNumber(item.quantity) &&
    item.quantity.greaterThan(1)
  )
}

/**
 * Replaces one item of quantity N with N items of quantity one, dividing every
 * amount by N. Amounts stay exact decimals; rounding happens only at display
 * (ADR-0002).
 */
export function explode(item: DraftItem): DraftItem[] {
  if (!canExplode(item)) return [item]

  const units = item.quantity.toNumber()
  return Array.from({ length: units }, () => ({
    ...item,
    key: nextItemKey(),
    quantity: new Decimal(1),
    grossAmount: item.grossAmount.dividedBy(units),
    discount: item.discount.dividedBy(units),
    netAmount: item.netAmount.dividedBy(units),
  }))
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- src/domain/items.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/items.ts src/domain/items.test.ts
git commit -m "feat: add draft items and explode"
```

---

## Task 6: Shares and balances

The arithmetic of dividing cost. Read ADR-0002 before writing a single assertion here — displayed shares are **allowed** not to sum to the item total, and a test that demands they do is a wrong test.

**Files:**
- Create: `src/domain/shares.ts`
- Test: `src/domain/shares.test.ts`

**Interfaces:**
- Consumes: `Decimal` from `@/domain/money`.
- Produces:
  - `interface AssignedItem { id: string; netAmount: Decimal; assigneeIds: string[] }`
  - `shareFor(item: AssignedItem, personId: string): Decimal`
  - `receiptTotals(items: AssignedItem[]): Map<string, Decimal>`
  - `unassignedItems(items: AssignedItem[]): AssignedItem[]`
  - `isComplete(items: AssignedItem[]): boolean`
  - `balanceFor(shares: Decimal, settlements: Decimal): Decimal`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/shares.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePtDecimal, Decimal } from './money'
import {
  shareFor,
  receiptTotals,
  unassignedItems,
  isComplete,
  balanceFor,
  type AssignedItem,
} from './shares'

const wine: AssignedItem = {
  id: 'wine',
  netAmount: parsePtDecimal('18,00'),
  assigneeIds: ['ana', 'bruno', 'owner'],
}

describe('shareFor', () => {
  it('divides equally among assignees', () => {
    expect(shareFor(wine, 'ana').toString()).toBe('6')
  })

  it('is zero for someone not assigned', () => {
    expect(shareFor(wine, 'carla').toString()).toBe('0')
  })

  it('is zero when nobody is assigned', () => {
    const orphan: AssignedItem = {
      id: 'orphan',
      netAmount: parsePtDecimal('5,00'),
      assigneeIds: [],
    }
    expect(shareFor(orphan, 'ana').toString()).toBe('0')
  })

  it('keeps a repeating share exact rather than rounding to cents', () => {
    const tenner: AssignedItem = {
      id: 'tenner',
      netAmount: parsePtDecimal('10,00'),
      assigneeIds: ['ana', 'bruno', 'owner'],
    }
    // ADR-0002: exact storage, rounding only at display. Do not "fix" this.
    expect(shareFor(tenner, 'ana').toDecimalPlaces(4).toString()).toBe('3.3333')
  })
})

describe('receiptTotals', () => {
  it('sums each person across items', () => {
    const beer: AssignedItem = {
      id: 'beer',
      netAmount: parsePtDecimal('44,85'),
      assigneeIds: ['ana', 'bruno'],
    }
    const totals = receiptTotals([wine, beer])
    expect(totals.get('ana')!.toString()).toBe('28.425')
    expect(totals.get('bruno')!.toString()).toBe('28.425')
    expect(totals.get('owner')!.toString()).toBe('6')
  })

  it('omits people with no assignments', () => {
    expect(receiptTotals([wine]).has('carla')).toBe(false)
  })

  it('returns an empty map for no items', () => {
    expect(receiptTotals([]).size).toBe(0)
  })
})

describe('completeness', () => {
  const orphan: AssignedItem = {
    id: 'orphan',
    netAmount: parsePtDecimal('5,00'),
    assigneeIds: [],
  }

  it('lists items with no assignees', () => {
    expect(unassignedItems([wine, orphan]).map((i) => i.id)).toEqual(['orphan'])
  })

  it('is incomplete when any item is unassigned', () => {
    expect(isComplete([wine, orphan])).toBe(false)
  })

  it('is complete when every item has an assignee', () => {
    expect(isComplete([wine])).toBe(true)
  })

  it('treats an empty receipt as complete', () => {
    expect(isComplete([])).toBe(true)
  })
})

describe('balanceFor', () => {
  it('is what is owed after settlements', () => {
    expect(
      balanceFor(parsePtDecimal('23,40'), parsePtDecimal('10,00')).toString(),
    ).toBe('13.4')
  })

  it('goes negative when a person has overpaid', () => {
    expect(
      balanceFor(parsePtDecimal('17,40'), parsePtDecimal('23,40')).toString(),
    ).toBe('-6')
  })

  it('is zero when settled exactly', () => {
    expect(balanceFor(new Decimal(5), new Decimal(5)).isZero()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/shares.test.ts`
Expected: FAIL — cannot resolve `./shares`.

- [ ] **Step 3: Implement**

Create `src/domain/shares.ts`:

```ts
import { Decimal } from './money'

export interface AssignedItem {
  id: string
  netAmount: Decimal
  assigneeIds: string[]
}

/**
 * A person's portion of an item: its net amount divided equally among its
 * assignees. Everyone assigned bears an identical share regardless of how much
 * they consumed. Kept exact; rounded only for display (ADR-0002).
 */
export function shareFor(item: AssignedItem, personId: string): Decimal {
  if (!item.assigneeIds.includes(personId)) return new Decimal(0)
  return item.netAmount.dividedBy(item.assigneeIds.length)
}

export function receiptTotals(items: AssignedItem[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>()

  for (const item of items) {
    if (item.assigneeIds.length === 0) continue
    const share = item.netAmount.dividedBy(item.assigneeIds.length)

    for (const personId of item.assigneeIds) {
      totals.set(personId, (totals.get(personId) ?? new Decimal(0)).plus(share))
    }
  }

  return totals
}

export function unassignedItems(items: AssignedItem[]): AssignedItem[] {
  return items.filter((item) => item.assigneeIds.length === 0)
}

export function isComplete(items: AssignedItem[]): boolean {
  return unassignedItems(items).length === 0
}

export function balanceFor(shares: Decimal, settlements: Decimal): Decimal {
  return shares.minus(settlements)
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- src/domain/shares.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. The domain is now complete and fully tested with no I/O anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/domain/shares.ts src/domain/shares.test.ts
git commit -m "feat: add share, receipt total and balance arithmetic"
```

---

## Task 7: Database schema

Five tables, all money as `NUMERIC`, all rows owned by a Supabase auth user and fenced by row-level security.

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `docs/schema.md`

**Interfaces:**
- Consumes: a Supabase project.
- Produces: tables `people`, `receipts`, `items`, `assignments`, `settlements`, all RLS-protected on `owner_user_id`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
-- People. Exactly one per owner is flagged as the Owner.
create table people (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index people_one_owner_per_user
  on people (owner_user_id)
  where is_owner;

create unique index people_unique_name_per_user
  on people (owner_user_id, lower(name));

-- One shopping trip. stated_* come from the transcription's TOTAL row and are
-- kept so reconciliation can be re-checked later.
create table receipts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  merchant text not null default '',
  store text not null default '',
  purchased_on date not null,
  payer_person_id uuid not null references people (id) on delete restrict,
  source_filename text not null default '',
  source_csv text not null default '',
  stated_gross numeric(12, 4),
  stated_discount numeric(12, 4),
  stated_net numeric(12, 4),
  created_at timestamptz not null default now()
);

create index receipts_by_date on receipts (owner_user_id, purchased_on desc);

-- Money is numeric, never float. Amounts are stored exactly; rounding to cents
-- happens only at display (ADR-0002).
create table items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  position integer not null,
  category text not null default '',
  description text not null,
  quantity numeric(12, 4) not null,
  quantity_kind text not null check (quantity_kind in ('count', 'weight')),
  unit_price numeric(12, 4) not null,
  gross_amount numeric(12, 4) not null,
  discount numeric(12, 4) not null default 0,
  net_amount numeric(12, 4) not null
);

create index items_by_receipt on items (receipt_id, position);

-- A person is responsible for an item. Cost divides equally among these rows.
create table assignments (
  item_id uuid not null references items (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (item_id, person_id)
);

create index assignments_by_person on assignments (person_id);

-- A recorded amount handed over, never a boolean flag (ADR-0003).
create table settlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  amount numeric(12, 4) not null,
  settled_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index settlements_by_person on settlements (person_id, settled_on desc);

-- Row-level security: every row reachable only by the user who owns it.
alter table people enable row level security;
alter table receipts enable row level security;
alter table items enable row level security;
alter table assignments enable row level security;
alter table settlements enable row level security;

create policy people_owner on people
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy receipts_owner on receipts
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy items_owner on items
  for all using (
    exists (
      select 1 from receipts r
      where r.id = items.receipt_id and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = items.receipt_id and r.owner_user_id = auth.uid()
    )
  );

create policy assignments_owner on assignments
  for all using (
    exists (
      select 1 from items i
      join receipts r on r.id = i.receipt_id
      where i.id = assignments.item_id and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from items i
      join receipts r on r.id = i.receipt_id
      where i.id = assignments.item_id and r.owner_user_id = auth.uid()
    )
  );

create policy settlements_owner on settlements
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
```

- [ ] **Step 2: Apply the migration**

Apply it to the Supabase project (via the Supabase MCP `apply_migration`, the dashboard SQL editor, or `supabase db push`).

- [ ] **Step 3: Verify the schema landed**

Run a `list_tables` (or `\dt` equivalent) against the project.
Expected: `people`, `receipts`, `items`, `assignments`, `settlements` all present, all with RLS enabled.

- [ ] **Step 4: Verify RLS actually denies**

With an anonymous (unauthenticated) client, run `select * from receipts`.
Expected: zero rows and no error — RLS filters rather than throwing. If rows come back, RLS is not enabled and this task is not done.

- [ ] **Step 5: Document the schema**

Create `docs/schema.md` with a short table-by-table description mirroring the vocabulary in `CONTEXT.md`, noting that `numeric(12,4)` holds exact amounts and that four decimal places exist so a divided share survives a round trip.

- [ ] **Step 6: Commit**

```bash
git add supabase docs/schema.md
git commit -m "feat: add initial database schema with row-level security"
```

---

## Task 8: Supabase clients, magic-link auth, and route protection

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/proxy.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces:
  - `createBrowserSupabase(): SupabaseClient`
  - `createServerSupabase(): Promise<SupabaseClient>` — reads and writes request cookies.
  - `requireUser(): Promise<{ id: string; email: string }>` — redirects to `/login` when signed out. Every server action and protected page calls this first.

- [ ] **Step 1: Create the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: Create the server client and the auth guard**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  )
}

export async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  return { id: user.id, email: user.email ?? '' }
}
```

- [ ] **Step 3: Build the login page**

Create `src/app/login/page.tsx`:

```tsx
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Divisão de Contas</h1>

      {status === 'sent' ? (
        <p className="rounded-lg bg-green-50 p-4 text-green-900">
          Check {email} for your sign-in link.
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
            className="rounded-lg border p-3 text-base"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-black p-3 text-white disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && <p className="text-red-700">{message}</p>}
        </form>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Build the callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(origin)
  }

  return NextResponse.redirect(`${origin}/login`)
}
```

- [ ] **Step 5: Add a proxy to refresh the session**

Next 16 renamed `middleware.ts` to `proxy.ts` and the exported function to
`proxy`. With `--src-dir`, create `web/src/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = path.startsWith('/login') || path.startsWith('/auth')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)'],
}
```

- [ ] **Step 6: Make the home page prove auth works**

Replace `src/app/page.tsx`:

```tsx
import { requireUser } from '@/lib/supabase/server'

export default async function HomePage() {
  const user = await requireUser()

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Signed in as {user.email}</h1>
    </main>
  )
}
```

Also set the app title and a mobile viewport in `src/app/layout.tsx`:

```tsx
export const metadata = { title: 'Divisão de Contas' }
export const viewport = { width: 'device-width', initialScale: 1 }
```

- [ ] **Step 7: Configure Supabase auth**

In the Supabase dashboard under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL. Copy the project URL and anon key into `.env.local`.

- [ ] **Step 8: Verify the whole loop by hand**

Run `npm run dev`, then:
1. Visit `http://localhost:3000` → expect a redirect to `/login`.
2. Enter `henriquevmac@gmail.com` and submit → expect the "check your email" state.
3. Open the emailed link → expect to land on `/` showing "Signed in as henriquevmac@gmail.com".

Expected: all three succeed. This is manual verification; do not claim it passes without doing it.

- [ ] **Step 9: Seed the Owner person**

Insert one row into `people` with your `auth.users` id, your name, and `is_owner = true`. Note the id.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase src/app/login src/app/auth src/proxy.ts src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add Supabase magic-link auth and route protection"
```

---

## Task 9: Persistence layer

The Supabase JS client has no multi-statement transactions, so saving a verified receipt goes through a Postgres function. Everything else is plain queries plus mapping between `NUMERIC` (which the driver hands back as a string) and `Decimal`.

**Files:**
- Create: `supabase/migrations/0002_save_receipt.sql`
- Create: `src/lib/db/types.ts`
- Create: `src/lib/db/receipts.ts`
- Create: `src/lib/db/people.ts`
- Create: `src/lib/db/assignments.ts`
- Test: `src/lib/db/types.test.ts`

**Interfaces:**
- Consumes: `Decimal` from `@/domain/money`; `DraftItem` from `@/domain/items`; `createServerSupabase` from `@/lib/supabase/server`.
- Produces:
  - `toDecimal(value: string | number | null): Decimal`
  - `toNumericString(value: Decimal): string`
  - `interface PersonRow { id: string; name: string; isOwner: boolean }`
  - `interface ItemRow extends DraftItem { id: string; assigneeIds: string[] }`
  - `interface ReceiptRow { id: string; merchant: string; store: string; purchasedOn: string; payerPersonId: string; statedNet: Decimal | null }`
  - `saveVerifiedReceipt(input: SaveReceiptInput): Promise<string>` — returns the new receipt id.
  - `listReceipts(): Promise<Array<ReceiptRow & { itemCount: number; net: Decimal; unassignedCount: number }>>`
  - `getReceipt(id: string): Promise<{ receipt: ReceiptRow; items: ItemRow[] } | null>`
  - `explodeItem(itemId: string): Promise<void>`
  - `listPeople(): Promise<PersonRow[]>`, `createPerson(name)`, `renamePerson(id, name)`, `deletePerson(id)`
  - `listSettlements(personId)`, `recordSettlement(personId, amount, settledOn, note)`
  - `setAssignments(itemIds: string[], personIds: string[]): Promise<void>` — replaces assignments on every listed item.

- [ ] **Step 1: Write the save function migration**

Create `supabase/migrations/0002_save_receipt.sql`:

```sql
-- Writes a verified receipt and all its items atomically. Called only after
-- the user confirms verification; nothing reaches the database before that.
create or replace function save_verified_receipt(
  p_merchant text,
  p_store text,
  p_purchased_on date,
  p_payer_person_id uuid,
  p_source_filename text,
  p_source_csv text,
  p_stated_gross numeric,
  p_stated_discount numeric,
  p_stated_net numeric,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_receipt_id uuid;
begin
  insert into receipts (
    owner_user_id, merchant, store, purchased_on, payer_person_id,
    source_filename, source_csv, stated_gross, stated_discount, stated_net
  ) values (
    auth.uid(), p_merchant, p_store, p_purchased_on, p_payer_person_id,
    p_source_filename, p_source_csv, p_stated_gross, p_stated_discount, p_stated_net
  ) returning id into v_receipt_id;

  insert into items (
    receipt_id, position, category, description,
    quantity, quantity_kind, unit_price, gross_amount, discount, net_amount
  )
  select
    v_receipt_id,
    (item ->> 'position')::integer,
    item ->> 'category',
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    item ->> 'quantityKind',
    (item ->> 'unitPrice')::numeric,
    (item ->> 'grossAmount')::numeric,
    (item ->> 'discount')::numeric,
    (item ->> 'netAmount')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_receipt_id;
end;
$$;
```

Apply it the same way as Task 7's migration.

- [ ] **Step 2: Write the failing mapping tests**

Create `src/lib/db/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Decimal } from '@/domain/money'
import { toDecimal, toNumericString } from './types'

describe('toDecimal', () => {
  it('reads the string Postgres returns for numeric', () => {
    expect(toDecimal('191.2200').toString()).toBe('191.22')
  })

  it('reads a number', () => {
    expect(toDecimal(3).toString()).toBe('3')
  })

  it('treats null as zero', () => {
    expect(toDecimal(null).toString()).toBe('0')
  })
})

describe('toNumericString', () => {
  it('renders with a dot for Postgres', () => {
    expect(toNumericString(new Decimal('1.99'))).toBe('1.99')
  })

  it('truncates an exact repeating share to the column scale', () => {
    // numeric(12,4): four places is what the column stores.
    expect(toNumericString(new Decimal(10).dividedBy(3))).toBe('3.3333')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/lib/db/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 4: Implement the mapping helpers**

Create `src/lib/db/types.ts`:

```ts
import { Decimal } from '@/domain/money'
import type { DraftItem } from '@/domain/items'

/** Scale of every numeric column in the schema. */
export const MONEY_SCALE = 4

export function toDecimal(value: string | number | null): Decimal {
  if (value === null) return new Decimal(0)
  return new Decimal(value)
}

export function toNumericString(value: Decimal): string {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toString()
}

export interface PersonRow {
  id: string
  name: string
  isOwner: boolean
}

export interface ReceiptRow {
  id: string
  merchant: string
  store: string
  /** ISO date, YYYY-MM-DD. */
  purchasedOn: string
  payerPersonId: string
  statedNet: Decimal | null
}

export interface ItemRow extends DraftItem {
  /** Database id. `key` from DraftItem mirrors it for React. */
  id: string
  position: number
  assigneeIds: string[]
}

export interface SettlementRow {
  id: string
  personId: string
  amount: Decimal
  settledOn: string
  note: string
}
```

- [ ] **Step 5: Run to verify passing**

Run: `npm test -- src/lib/db/types.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Implement the receipt queries**

Create `src/lib/db/receipts.ts`:

```ts
import { Decimal } from '@/domain/money'
import { canExplode, explode, type DraftItem } from '@/domain/items'
import { createServerSupabase, requireUser } from '@/lib/supabase/server'
import { toDecimal, toNumericString, type ItemRow, type ReceiptRow } from './types'

export interface SaveReceiptInput {
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
  sourceFilename: string
  sourceCsv: string
  statedGross: Decimal | null
  statedDiscount: Decimal | null
  statedNet: Decimal | null
  items: DraftItem[]
}

export async function saveVerifiedReceipt(
  input: SaveReceiptInput,
): Promise<string> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase.rpc('save_verified_receipt', {
    p_merchant: input.merchant,
    p_store: input.store,
    p_purchased_on: input.purchasedOn,
    p_payer_person_id: input.payerPersonId,
    p_source_filename: input.sourceFilename,
    p_source_csv: input.sourceCsv,
    p_stated_gross: input.statedGross ? toNumericString(input.statedGross) : null,
    p_stated_discount: input.statedDiscount
      ? toNumericString(input.statedDiscount)
      : null,
    p_stated_net: input.statedNet ? toNumericString(input.statedNet) : null,
    p_items: input.items.map((item, position) => ({
      position,
      category: item.category,
      description: item.description,
      quantity: toNumericString(item.quantity),
      quantityKind: item.quantityKind,
      unitPrice: toNumericString(item.unitPrice),
      grossAmount: toNumericString(item.grossAmount),
      discount: toNumericString(item.discount),
      netAmount: toNumericString(item.netAmount),
    })),
  })

  if (error) throw new Error(`Could not save the receipt: ${error.message}`)
  return data as string
}

const ITEM_COLUMNS =
  'id, position, category, description, quantity, quantity_kind, unit_price, gross_amount, discount, net_amount, assignments (person_id)'

type RawItem = {
  id: string
  position: number
  category: string
  description: string
  quantity: string
  quantity_kind: 'count' | 'weight'
  unit_price: string
  gross_amount: string
  discount: string
  net_amount: string
  assignments: Array<{ person_id: string }>
}

function mapItem(raw: RawItem): ItemRow {
  return {
    id: raw.id,
    key: raw.id,
    position: raw.position,
    category: raw.category,
    description: raw.description,
    quantity: toDecimal(raw.quantity),
    quantityKind: raw.quantity_kind,
    unitPrice: toDecimal(raw.unit_price),
    grossAmount: toDecimal(raw.gross_amount),
    discount: toDecimal(raw.discount),
    netAmount: toDecimal(raw.net_amount),
    assigneeIds: raw.assignments.map((a) => a.person_id),
  }
}

export async function getReceipt(
  id: string,
): Promise<{ receipt: ReceiptRow; items: ItemRow[] } | null> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, merchant, store, purchased_on, payer_person_id, stated_net')
    .eq('id', id)
    .maybeSingle()

  if (!receipt) return null

  const { data: items, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('receipt_id', id)
    .order('position')

  if (error) throw new Error(`Could not load items: ${error.message}`)

  return {
    receipt: {
      id: receipt.id,
      merchant: receipt.merchant,
      store: receipt.store,
      purchasedOn: receipt.purchased_on,
      payerPersonId: receipt.payer_person_id,
      statedNet: receipt.stated_net ? toDecimal(receipt.stated_net) : null,
    },
    items: (items as RawItem[]).map(mapItem),
  }
}

export async function listReceipts() {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('receipts')
    .select(
      `id, merchant, store, purchased_on, payer_person_id, stated_net, items (${ITEM_COLUMNS})`,
    )
    .order('purchased_on', { ascending: false })

  if (error) throw new Error(`Could not list receipts: ${error.message}`)

  return (data ?? []).map((row: any) => {
    const items = (row.items as RawItem[]).map(mapItem)
    return {
      id: row.id,
      merchant: row.merchant,
      store: row.store,
      purchasedOn: row.purchased_on,
      payerPersonId: row.payer_person_id,
      statedNet: row.stated_net ? toDecimal(row.stated_net) : null,
      itemCount: items.length,
      net: items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0)),
      unassignedCount: items.filter((item) => item.assigneeIds.length === 0).length,
    }
  })
}

/** Replaces a saved item with its exploded units, preserving assignments. */
export async function explodeItem(itemId: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: raw, error } = await supabase
    .from('items')
    .select(`receipt_id, ${ITEM_COLUMNS}`)
    .eq('id', itemId)
    .single()

  if (error || !raw) throw new Error('Item not found')

  const original = mapItem(raw as unknown as RawItem)
  if (!canExplode(original)) throw new Error('This item cannot be exploded')

  const parts = explode(original)
  const receiptId = (raw as any).receipt_id

  const { data: inserted, error: insertError } = await supabase
    .from('items')
    .insert(
      parts.map((part, offset) => ({
        receipt_id: receiptId,
        position: original.position + offset,
        category: part.category,
        description: part.description,
        quantity: toNumericString(part.quantity),
        quantity_kind: part.quantityKind,
        unit_price: toNumericString(part.unitPrice),
        gross_amount: toNumericString(part.grossAmount),
        discount: toNumericString(part.discount),
        net_amount: toNumericString(part.netAmount),
      })),
    )
    .select('id')

  if (insertError) throw new Error(`Could not explode: ${insertError.message}`)

  if (original.assigneeIds.length > 0) {
    await supabase.from('assignments').insert(
      inserted!.flatMap((row) =>
        original.assigneeIds.map((personId) => ({
          item_id: row.id,
          person_id: personId,
        })),
      ),
    )
  }

  await supabase.from('items').delete().eq('id', itemId)
}
```

- [ ] **Step 7: Implement people and settlements**

Create `src/lib/db/people.ts`:

```ts
import { Decimal } from '@/domain/money'
import { createServerSupabase, requireUser } from '@/lib/supabase/server'
import { toDecimal, toNumericString, type PersonRow, type SettlementRow } from './types'

export async function listPeople(): Promise<PersonRow[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('people')
    .select('id, name, is_owner')
    .order('is_owner', { ascending: false })
    .order('name')

  if (error) throw new Error(`Could not list people: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isOwner: row.is_owner,
  }))
}

export async function createPerson(name: string): Promise<void> {
  const user = await requireUser()
  const supabase = await createServerSupabase()

  const { error } = await supabase
    .from('people')
    .insert({ owner_user_id: user.id, name: name.trim(), is_owner: false })

  if (error) {
    throw new Error(
      error.code === '23505'
        ? `There is already someone called ${name.trim()}.`
        : `Could not create the person: ${error.message}`,
    )
  }
}

export async function renamePerson(id: string, name: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('people')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw new Error(`Could not rename: ${error.message}`)
}

/** Refuses to delete the Owner, and refuses if the person still has shares. */
export async function deletePerson(id: string): Promise<void> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data: person } = await supabase
    .from('people')
    .select('is_owner')
    .eq('id', id)
    .single()

  if (person?.is_owner) throw new Error('The Owner cannot be deleted.')

  const { count } = await supabase
    .from('assignments')
    .select('item_id', { count: 'exact', head: true })
    .eq('person_id', id)

  if ((count ?? 0) > 0) {
    throw new Error(
      'This person is still assigned to items. Unassign them first.',
    )
  }

  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(`Could not delete: ${error.message}`)
}

export async function listSettlements(personId: string): Promise<SettlementRow[]> {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('settlements')
    .select('id, person_id, amount, settled_on, note')
    .eq('person_id', personId)
    .order('settled_on', { ascending: false })

  if (error) throw new Error(`Could not list settlements: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    personId: row.person_id,
    amount: toDecimal(row.amount),
    settledOn: row.settled_on,
    note: row.note,
  }))
}

export async function recordSettlement(
  personId: string,
  amount: Decimal,
  settledOn: string,
  note: string,
): Promise<void> {
  const user = await requireUser()
  const supabase = await createServerSupabase()

  const { error } = await supabase.from('settlements').insert({
    owner_user_id: user.id,
    person_id: personId,
    amount: toNumericString(amount),
    settled_on: settledOn,
    note,
  })

  if (error) throw new Error(`Could not record the settlement: ${error.message}`)
}

/** Every item this person is assigned to, across every receipt. */
export async function sharesForPerson(personId: string) {
  await requireUser()
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'item_id, items (id, description, net_amount, receipt_id, receipts (merchant, purchased_on), assignments (person_id))',
    )
    .eq('person_id', personId)

  if (error) throw new Error(`Could not load shares: ${error.message}`)

  return (data ?? []).map((row: any) => ({
    itemId: row.items.id,
    description: row.items.description,
    receiptId: row.items.receipt_id,
    merchant: row.items.receipts.merchant,
    purchasedOn: row.items.receipts.purchased_on,
    share: toDecimal(row.items.net_amount).dividedBy(
      row.items.assignments.length,
    ),
  }))
}
```

- [ ] **Step 8: Implement bulk assignment**

Create `src/lib/db/assignments.ts`:

```ts
import { createServerSupabase, requireUser } from '@/lib/supabase/server'

/**
 * Replaces the assignments of every listed item with exactly `personIds`.
 * An empty `personIds` unassigns them.
 */
export async function setAssignments(
  itemIds: string[],
  personIds: string[],
): Promise<void> {
  await requireUser()
  if (itemIds.length === 0) return

  const supabase = await createServerSupabase()

  const { error: deleteError } = await supabase
    .from('assignments')
    .delete()
    .in('item_id', itemIds)

  if (deleteError) throw new Error(`Could not clear assignments: ${deleteError.message}`)
  if (personIds.length === 0) return

  const rows = itemIds.flatMap((itemId) =>
    personIds.map((personId) => ({ item_id: itemId, person_id: personId })),
  )

  const { error } = await supabase.from('assignments').insert(rows)
  if (error) throw new Error(`Could not assign: ${error.message}`)
}

/** Adds people to items without removing anyone already assigned. */
export async function addAssignments(
  itemIds: string[],
  personIds: string[],
): Promise<void> {
  await requireUser()
  if (itemIds.length === 0 || personIds.length === 0) return

  const supabase = await createServerSupabase()
  const rows = itemIds.flatMap((itemId) =>
    personIds.map((personId) => ({ item_id: itemId, person_id: personId })),
  )

  const { error } = await supabase
    .from('assignments')
    .upsert(rows, { onConflict: 'item_id,person_id', ignoreDuplicates: true })

  if (error) throw new Error(`Could not assign: ${error.message}`)
}
```

- [ ] **Step 9: Run the suite and the type checker**

```bash
npm test
npx tsc --noEmit
```

Expected: tests PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0002_save_receipt.sql src/lib/db
git commit -m "feat: add persistence layer for receipts, people and assignments"
```

---

## Task 10: Import and Verification screen

The screen that decides what enters the database. Parsing is client-side; the database is untouched until the user presses Save.

**Files:**
- Create: `src/components/Money.tsx`
- Create: `src/components/VerificationTable.tsx`
- Create: `src/app/import/page.tsx`
- Create: `src/app/import/ImportScreen.tsx`
- Create: `src/app/import/actions.ts`
- Test: `src/components/VerificationTable.test.tsx`

**Interfaces:**
- Consumes: `parseTranscription`, `parseReceiptFilename`, `reconcile`, `draftItemsFromLines`, `explode`, `canExplode`, `formatEuro`, `formatQuantity`, `saveVerifiedReceipt`, `listPeople`.
- Produces: `saveReceiptAction(formData: FormData): Promise<void>` — server action that saves and redirects to the new receipt.

- [ ] **Step 1: Write the Money component**

Create `src/components/Money.tsx`:

```tsx
import { formatEuro, type Decimal } from '@/domain/money'

export function Money({ value, className }: { value: Decimal; className?: string }) {
  return <span className={`tabular-nums ${className ?? ''}`}>{formatEuro(value)}</span>
}
```

- [ ] **Step 2: Write the failing VerificationTable test**

Create `src/components/VerificationTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { parsePtDecimal } from '@/domain/money'
import { VerificationTable } from './VerificationTable'
import type { DraftItem } from '@/domain/items'

function items(): DraftItem[] {
  return [
    {
      key: 'a',
      category: 'BEBIDAS',
      description: 'CERVEJA LOIRA 30X25CL',
      quantity: parsePtDecimal('3'),
      quantityKind: 'count',
      unitPrice: parsePtDecimal('14,95'),
      grossAmount: parsePtDecimal('44,85'),
      discount: parsePtDecimal('0,00'),
      netAmount: parsePtDecimal('44,85'),
    },
    {
      key: 'b',
      category: 'TALHO',
      description: 'PORCO BIFANAS/ASSAR',
      quantity: parsePtDecimal('1,532'),
      quantityKind: 'weight',
      unitPrice: parsePtDecimal('4,99'),
      grossAmount: parsePtDecimal('7,64'),
      discount: parsePtDecimal('0,76'),
      netAmount: parsePtDecimal('6,88'),
    },
  ]
}

describe('VerificationTable', () => {
  it('renders every item', () => {
    render(<VerificationTable items={items()} onChange={() => {}} />)
    expect(screen.getByDisplayValue('CERVEJA LOIRA 30X25CL')).toBeInTheDocument()
    expect(screen.getByDisplayValue('PORCO BIFANAS/ASSAR')).toBeInTheDocument()
  })

  it('offers Explode on a count of 3 but not on a weight', () => {
    render(<VerificationTable items={items()} onChange={() => {}} />)
    expect(screen.getAllByRole('button', { name: /explode/i })).toHaveLength(1)
  })

  it('replaces an item with its units when Explode is pressed', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /explode/i }))

    const next = onChange.mock.calls[0][0] as DraftItem[]
    expect(next).toHaveLength(4)
    expect(next.filter((i) => i.description === 'CERVEJA LOIRA 30X25CL')).toHaveLength(3)
  })

  it('removes an item when Delete is pressed', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect((onChange.mock.calls[0][0] as DraftItem[])).toHaveLength(1)
  })

  it('edits a net amount', () => {
    const onChange = vi.fn()
    render(<VerificationTable items={items()} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Net amount for CERVEJA LOIRA 30X25CL'), {
      target: { value: '40,00' },
    })
    const next = onChange.mock.calls[0][0] as DraftItem[]
    expect(next[0].netAmount.toString()).toBe('40')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/components/VerificationTable.test.tsx`
Expected: FAIL — cannot resolve `./VerificationTable`.

- [ ] **Step 4: Implement VerificationTable**

Create `src/components/VerificationTable.tsx`:

```tsx
'use client'

import { parsePtDecimal, formatQuantity, MoneyParseError } from '@/domain/money'
import { canExplode, explode, type DraftItem } from '@/domain/items'

interface Props {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
}

export function VerificationTable({ items, onChange }: Props) {
  function replaceAt(index: number, item: DraftItem) {
    onChange(items.map((existing, i) => (i === index ? item : existing)))
  }

  function editNet(index: number, raw: string) {
    try {
      replaceAt(index, { ...items[index], netAmount: parsePtDecimal(raw) })
    } catch (error) {
      if (!(error instanceof MoneyParseError)) throw error
      // Ignore keystrokes that are not yet a number.
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.key} className="rounded-lg border p-3">
          <input
            aria-label={`Description for ${item.description}`}
            value={item.description}
            onChange={(event) =>
              replaceAt(index, { ...item, description: event.target.value })
            }
            className="w-full border-b bg-transparent pb-1 text-base font-medium"
          />

          <div className="mt-2 flex items-center gap-3 text-sm text-neutral-600">
            <span>{item.category}</span>
            <span>
              {formatQuantity(item.quantity)}
              {item.quantityKind === 'weight' ? ' kg' : '×'}
            </span>
            <label className="ml-auto flex items-center gap-1">
              <input
                aria-label={`Net amount for ${item.description}`}
                defaultValue={item.netAmount.toDecimalPlaces(2).toString().replace('.', ',')}
                onChange={(event) => editNet(index, event.target.value)}
                inputMode="decimal"
                className="w-24 rounded border p-1 text-right tabular-nums"
              />
              <span>€</span>
            </label>
          </div>

          <div className="mt-2 flex gap-3 text-sm">
            {canExplode(item) && (
              <button
                type="button"
                onClick={() =>
                  onChange(items.flatMap((e, i) => (i === index ? explode(e) : [e])))
                }
                className="text-blue-700 underline"
              >
                Explode into {item.quantity.toFixed(0)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="ml-auto text-red-700 underline"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Run to verify passing**

Run: `npm test -- src/components/VerificationTable.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the save server action**

Create `src/app/import/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { Decimal } from '@/domain/money'
import { nextItemKey } from '@/domain/items'
import { saveVerifiedReceipt } from '@/lib/db/receipts'

/** Amounts arrive as plain decimal strings, already validated client-side. */
export interface SerialisedItem {
  category: string
  description: string
  quantity: string
  quantityKind: 'count' | 'weight'
  unitPrice: string
  grossAmount: string
  discount: string
  netAmount: string
}

export async function saveReceiptAction(payload: {
  merchant: string
  store: string
  purchasedOn: string
  payerPersonId: string
  sourceFilename: string
  sourceCsv: string
  statedGross: string | null
  statedDiscount: string | null
  statedNet: string | null
  items: SerialisedItem[]
}) {
  const id = await saveVerifiedReceipt({
    merchant: payload.merchant,
    store: payload.store,
    purchasedOn: payload.purchasedOn,
    payerPersonId: payload.payerPersonId,
    sourceFilename: payload.sourceFilename,
    sourceCsv: payload.sourceCsv,
    statedGross: payload.statedGross ? new Decimal(payload.statedGross) : null,
    statedDiscount: payload.statedDiscount
      ? new Decimal(payload.statedDiscount)
      : null,
    statedNet: payload.statedNet ? new Decimal(payload.statedNet) : null,
    items: payload.items.map((item) => ({
      key: nextItemKey(),
      category: item.category,
      description: item.description,
      quantity: new Decimal(item.quantity),
      quantityKind: item.quantityKind,
      unitPrice: new Decimal(item.unitPrice),
      grossAmount: new Decimal(item.grossAmount),
      discount: new Decimal(item.discount),
      netAmount: new Decimal(item.netAmount),
    })),
  })

  redirect(`/receipts/${id}`)
}
```

- [ ] **Step 7: Build the import screen**

Create `src/app/import/ImportScreen.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Decimal } from '@/domain/money'
import { parseTranscription, TranscriptionParseError } from '@/domain/transcription/parse'
import { parseReceiptFilename } from '@/domain/transcription/filename'
import { draftItemsFromLines, nextItemKey, type DraftItem } from '@/domain/items'
import type { TranscriptionTotals } from '@/domain/transcription/types'
import { VerificationTable } from '@/components/VerificationTable'
import { Money } from '@/components/Money'
import { saveReceiptAction } from './actions'
import type { PersonRow } from '@/lib/db/types'

export function ImportScreen({ people }: { people: PersonRow[] }) {
  const [items, setItems] = useState<DraftItem[] | null>(null)
  const [totals, setTotals] = useState<TranscriptionTotals | null>(null)
  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [merchant, setMerchant] = useState('')
  const [store, setStore] = useState('')
  const [purchasedOn, setPurchasedOn] = useState('')
  const [payerId, setPayerId] = useState(
    people.find((person) => person.isOwner)?.id ?? people[0]?.id ?? '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    try {
      const parsed = parseTranscription(text)
      const metadata = parseReceiptFilename(file.name)

      setCsv(text)
      setFilename(file.name)
      setItems(draftItemsFromLines(parsed.lines))
      setTotals(parsed.totals)
      setMerchant(metadata.merchant)
      setStore(metadata.store)
      setPurchasedOn(metadata.purchasedOn || new Date().toISOString().slice(0, 10))
      setError('')
    } catch (caught) {
      setItems(null)
      setError(
        caught instanceof TranscriptionParseError
          ? caught.message
          : 'That file could not be read as a transcription.',
      )
    }
  }

  if (!items) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Import a receipt</h1>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
          className="rounded-lg border p-3"
        />
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      </main>
    )
  }

  const linesNet = items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0))
  const statedNet = totals?.net ?? null
  const difference = statedNet ? statedNet.minus(linesNet) : null
  const mismatch = difference !== null && !difference.isZero()

  async function save() {
    setSaving(true)
    try {
      await saveReceiptAction({
        merchant,
        store,
        purchasedOn,
        payerPersonId: payerId,
        sourceFilename: filename,
        sourceCsv: csv,
        statedGross: totals?.gross.toString() ?? null,
        statedDiscount: totals?.discount.toString() ?? null,
        statedNet: totals?.net.toString() ?? null,
        items: items!.map((item) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity.toString(),
          quantityKind: item.quantityKind,
          unitPrice: item.unitPrice.toString(),
          grossAmount: item.grossAmount.toString(),
          discount: item.discount.toString(),
          netAmount: item.netAmount.toString(),
        })),
      })
    } catch (caught) {
      setSaving(false)
      setError(caught instanceof Error ? caught.message : 'Could not save.')
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-28">
      <h1 className="text-xl font-semibold">Verify before saving</h1>

      <section className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm">
          Merchant
          <input
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Store
          <input
            value={store}
            onChange={(event) => setStore(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Date
          <input
            type="date"
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
            className="rounded border p-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm">
          Paid by
          <select
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            className="rounded border p-2 text-base"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {mismatch && (
        <p className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900">
          These {items.length} lines sum to <Money value={linesNet} />, but the
          receipt says <Money value={statedNet!} /> — a difference of{' '}
          <Money value={difference!.abs()} />. Check for a dropped or misread
          line. You can still save.
        </p>
      )}

      {!mismatch && statedNet && (
        <p className="rounded-lg bg-green-50 p-3 text-green-900">
          Reconciled: {items.length} lines sum to <Money value={linesNet} />.
        </p>
      )}

      <VerificationTable items={items} onChange={setItems} />

      <button
        type="button"
        onClick={() =>
          setItems([
            ...items!,
            {
              key: nextItemKey(),
              category: '',
              description: 'New item',
              quantity: new Decimal(1),
              quantityKind: 'count',
              unitPrice: new Decimal(0),
              grossAmount: new Decimal(0),
              discount: new Decimal(0),
              netAmount: new Decimal(0),
            },
          ])
        }
        className="rounded-lg border border-dashed p-3 text-neutral-700"
      >
        Add a line
      </button>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || items.length === 0 || !payerId}
          className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Save ${items.length} items`}
        </button>
      </div>
    </main>
  )
}
```

Create `src/app/import/page.tsx`:

```tsx
import { listPeople } from '@/lib/db/people'
import { ImportScreen } from './ImportScreen'

export default async function ImportPage() {
  const people = await listPeople()
  return <ImportScreen people={people} />
}
```

- [ ] **Step 8: Verify by hand with the real file**

Run `npm run dev`, sign in, go to `/import`, upload `super_bairro_centro_24-08-2026.csv`.
Expected: merchant "Super Bairro", store "Centro", date 2026-08-24, a green reconciled banner reading 191,22 €, and 34 editable rows. Delete a row and confirm the banner turns red and names the difference. Undo by re-uploading, then save.
Expected: redirect to `/receipts/<id>`, which 404s until Task 12 — that is correct at this point. Confirm in Supabase that one receipt and 34 items exist.

- [ ] **Step 9: Commit**

```bash
git add src/components src/app/import
git commit -m "feat: add CSV import with reconciliation and verification"
```

---

## Task 11: People management

**Files:**
- Create: `src/app/people/actions.ts`
- Create: `src/app/people/page.tsx`
- Create: `src/app/people/PeopleScreen.tsx`

**Interfaces:**
- Consumes: `listPeople`, `createPerson`, `renamePerson`, `deletePerson` from `@/lib/db/people`.
- Produces: `createPersonAction`, `renamePersonAction`, `deletePersonAction` — each returns `{ error: string } | undefined`.

- [ ] **Step 1: Write the server actions**

Create `src/app/people/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createPerson, renamePerson, deletePerson } from '@/lib/db/people'

function fail(error: unknown) {
  return { error: error instanceof Error ? error.message : 'Something went wrong.' }
}

export async function createPersonAction(name: string) {
  if (name.trim() === '') return { error: 'A name is required.' }
  try {
    await createPerson(name)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}

export async function renamePersonAction(id: string, name: string) {
  if (name.trim() === '') return { error: 'A name is required.' }
  try {
    await renamePerson(id, name)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}

export async function deletePersonAction(id: string) {
  try {
    await deletePerson(id)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}
```

- [ ] **Step 2: Build the screen**

Create `src/app/people/PeopleScreen.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Money } from '@/components/Money'
import type { Decimal } from '@/domain/money'
import { createPersonAction, deletePersonAction, renamePersonAction } from './actions'

export interface PersonWithBalance {
  id: string
  name: string
  isOwner: boolean
  balance: Decimal
}

export function PeopleScreen({ people }: { people: PersonWithBalance[] }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function add(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createPersonAction(name)
      if (result?.error) {
        setError(result.error)
        return
      }
      setName('')
      setError('')
    })
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">People</h1>

      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <input
              aria-label={`Name for ${person.name}`}
              defaultValue={person.name}
              onBlur={(event) => {
                if (event.target.value.trim() === person.name) return
                startTransition(async () => {
                  const result = await renamePersonAction(
                    person.id,
                    event.target.value,
                  )
                  if (result?.error) setError(result.error)
                })
              }}
              className="min-w-0 flex-1 border-b border-transparent bg-transparent font-medium focus:border-neutral-400"
            />
            {person.isOwner && (
              <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">you</span>
            )}
            <Link href={`/people/${person.id}`} className="text-sm underline">
              Open
            </Link>
            <Money
              value={person.balance}
              className={person.balance.isNegative() ? 'text-green-700' : ''}
            />
            {!person.isOwner && (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const result = await deletePersonAction(person.id)
                    if (result?.error) setError(result.error)
                  })
                }
                className="text-sm text-red-700 underline"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add someone"
          className="flex-1 rounded-lg border p-3 text-base"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    </main>
  )
}
```

Create `src/app/people/page.tsx`:

```tsx
import { Decimal } from '@/domain/money'
import { balanceFor } from '@/domain/shares'
import { listPeople, listSettlements, sharesForPerson } from '@/lib/db/people'
import { PeopleScreen, type PersonWithBalance } from './PeopleScreen'

export default async function PeoplePage() {
  const people = await listPeople()

  const withBalances: PersonWithBalance[] = await Promise.all(
    people.map(async (person) => {
      const [shares, settlements] = await Promise.all([
        sharesForPerson(person.id),
        listSettlements(person.id),
      ])

      const shareTotal = shares.reduce(
        (sum, share) => sum.plus(share.share),
        new Decimal(0),
      )
      const settledTotal = settlements.reduce(
        (sum, settlement) => sum.plus(settlement.amount),
        new Decimal(0),
      )

      return {
        ...person,
        balance: balanceFor(shareTotal, settledTotal),
      }
    }),
  )

  return <PeopleScreen people={withBalances} />
}
```

- [ ] **Step 3: Verify by hand**

Run `npm run dev`, visit `/people`.
Expected: your Owner row with a `you` badge and no Delete button. Add "Ana" and "Bruno" — both appear with a balance of 0,00 €. Try adding "ana" again — expect the message "There is already someone called ana."

- [ ] **Step 4: Commit**

```bash
git add src/app/people
git commit -m "feat: add people management with balances"
```

---

## Task 12: Receipt view with bulk assignment

The screen you'll spend the most time in. Selection, category select-all, one bulk assign action, and a visible count of what is still unassigned.

**Files:**
- Create: `src/components/AssignSheet.tsx`
- Create: `src/components/ItemAssignmentList.tsx`
- Create: `src/app/receipts/[id]/actions.ts`
- Create: `src/app/receipts/[id]/page.tsx`
- Create: `src/app/receipts/[id]/ReceiptScreen.tsx`
- Test: `src/components/ItemAssignmentList.test.tsx`

**Interfaces:**
- Consumes: `getReceipt`, `explodeItem`, `listPeople`, `setAssignments`, `addAssignments`, `receiptTotals`, `unassignedItems`.
- Produces:
  - `assignAction(itemIds: string[], personIds: string[], receiptId: string, mode: 'replace' | 'add')`
  - `explodeItemAction(itemId: string, receiptId: string)`

- [ ] **Step 1: Write the failing list test**

Create `src/components/ItemAssignmentList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { parsePtDecimal } from '@/domain/money'
import { ItemAssignmentList } from './ItemAssignmentList'
import type { ItemRow } from '@/lib/db/types'

function item(overrides: Partial<ItemRow>): ItemRow {
  return {
    id: 'i1',
    key: 'i1',
    position: 0,
    category: 'BEBIDAS',
    description: 'AGUA',
    quantity: parsePtDecimal('1'),
    quantityKind: 'count',
    unitPrice: parsePtDecimal('0,50'),
    grossAmount: parsePtDecimal('0,50'),
    discount: parsePtDecimal('0,00'),
    netAmount: parsePtDecimal('0,50'),
    assigneeIds: [],
    ...overrides,
  }
}

const PEOPLE = [
  { id: 'owner', name: 'Antonio', isOwner: true },
  { id: 'ana', name: 'Ana', isOwner: false },
]

const ITEMS = [
  item({ id: 'i1', key: 'i1', category: 'BEBIDAS', description: 'AGUA' }),
  item({ id: 'i2', key: 'i2', category: 'BEBIDAS', description: 'VINHO' }),
  item({ id: 'i3', key: 'i3', category: 'TALHO', description: 'FRANGO' }),
]

describe('ItemAssignmentList', () => {
  it('groups items under their category', () => {
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getByText('BEBIDAS')).toBeInTheDocument()
    expect(screen.getByText('TALHO')).toBeInTheDocument()
  })

  it('selects a single item', () => {
    const onSelectedChange = vi.fn()
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={onSelectedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Select AGUA'))
    expect([...onSelectedChange.mock.calls[0][0]]).toEqual(['i1'])
  })

  it('selects every item in a category at once', () => {
    const onSelectedChange = vi.fn()
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={onSelectedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Select all in BEBIDAS'))
    expect([...onSelectedChange.mock.calls[0][0]].sort()).toEqual(['i1', 'i2'])
  })

  it('marks an unassigned item', () => {
    render(
      <ItemAssignmentList
        items={ITEMS}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getAllByText('Unassigned')).toHaveLength(3)
  })

  it('offers Explode only when a handler is given and the item is a count > 1', () => {
    const onExplode = vi.fn()
    render(
      <ItemAssignmentList
        items={[
          item({ id: 'i1', key: 'i1', quantity: parsePtDecimal('3') }),
          item({ id: 'i2', key: 'i2', quantity: parsePtDecimal('1') }),
        ]}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
        onExplode={onExplode}
      />,
    )
    const buttons = screen.getAllByRole('button', { name: /explode/i })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(onExplode).toHaveBeenCalledWith('i1')
  })

  it('names the assignees of an assigned item', () => {
    render(
      <ItemAssignmentList
        items={[item({ id: 'i1', key: 'i1', assigneeIds: ['ana', 'owner'] })]}
        people={PEOPLE}
        selected={new Set()}
        onSelectedChange={() => {}}
      />,
    )
    expect(screen.getByText('Ana, Antonio')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/ItemAssignmentList.test.tsx`
Expected: FAIL — cannot resolve `./ItemAssignmentList`.

- [ ] **Step 3: Implement the list**

Create `src/components/ItemAssignmentList.tsx`:

```tsx
'use client'

import { formatQuantity } from '@/domain/money'
import { canExplode } from '@/domain/items'
import { Money } from './Money'
import type { ItemRow, PersonRow } from '@/lib/db/types'

interface Props {
  items: ItemRow[]
  people: PersonRow[]
  selected: Set<string>
  onSelectedChange: (selected: Set<string>) => void
  /** Omitted in tests and wherever exploding is not offered. */
  onExplode?: (itemId: string) => void
}

function groupByCategory(items: ItemRow[]): Array<[string, ItemRow[]]> {
  const groups = new Map<string, ItemRow[]>()
  for (const item of items) {
    const key = item.category || 'Uncategorised'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
}

export function ItemAssignmentList({
  items,
  people,
  selected,
  onSelectedChange,
  onExplode,
}: Props) {
  const nameOf = new Map(people.map((person) => [person.id, person.name]))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function toggleCategory(categoryItems: ItemRow[]) {
    const allSelected = categoryItems.every((item) => selected.has(item.id))
    const next = new Set(selected)
    for (const item of categoryItems) {
      if (allSelected) next.delete(item.id)
      else next.add(item.id)
    }
    onSelectedChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByCategory(items).map(([category, categoryItems]) => (
        <section key={category}>
          <header className="flex items-center gap-2 border-b py-1">
            <input
              type="checkbox"
              aria-label={`Select all in ${category}`}
              checked={categoryItems.every((item) => selected.has(item.id))}
              onChange={() => toggleCategory(categoryItems)}
              className="size-5"
            />
            <h2 className="text-sm font-semibold text-neutral-600">{category}</h2>
          </header>

          <ul>
            {categoryItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 border-b py-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.description}`}
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="size-5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.description}</p>
                  <p className="text-xs text-neutral-500">
                    {formatQuantity(item.quantity)}
                    {item.quantityKind === 'weight' ? ' kg · ' : '× · '}
                    {item.assigneeIds.length === 0 ? (
                      <span className="font-medium text-red-700">Unassigned</span>
                    ) : (
                      <span>
                        {item.assigneeIds
                          .map((id) => nameOf.get(id) ?? '?')
                          .sort()
                          .join(', ')}
                      </span>
                    )}
                  </p>
                </div>
                {onExplode && canExplode(item) && (
                  <button
                    type="button"
                    onClick={() => onExplode(item.id)}
                    className="text-xs text-blue-700 underline"
                  >
                    Explode
                  </button>
                )}
                <Money value={item.netAmount} className="text-sm" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- src/components/ItemAssignmentList.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Build the assign sheet**

Create `src/components/AssignSheet.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { PersonRow } from '@/lib/db/types'

interface Props {
  people: PersonRow[]
  count: number
  onAssign: (personIds: string[], mode: 'replace' | 'add') => void
  onClose: () => void
}

export function AssignSheet({ people, count, onAssign, onClose }: Props) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end bg-black/40">
      <div className="rounded-t-2xl bg-white p-4">
        <h2 className="text-lg font-semibold">
          Assign {count} item{count === 1 ? '' : 's'} to…
        </h2>

        <ul className="my-4 flex flex-col gap-1">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex items-center gap-3 rounded-lg p-3 text-base">
                <input
                  type="checkbox"
                  checked={chosen.has(person.id)}
                  onChange={() => toggle(person.id)}
                  className="size-5"
                />
                {person.name}
                {person.isOwner && <span className="text-xs text-neutral-500">you</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'replace')}
            className="rounded-lg bg-black p-3 text-white disabled:opacity-50"
          >
            Assign to exactly these {chosen.size}
          </button>
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => onAssign([...chosen], 'add')}
            className="rounded-lg border p-3 disabled:opacity-50"
          >
            Add them, keep existing
          </button>
          <button
            type="button"
            onClick={() => onAssign([], 'replace')}
            className="rounded-lg border p-3 text-red-700"
          >
            Unassign everyone
          </button>
          <button type="button" onClick={onClose} className="p-3 text-neutral-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the server actions**

Create `src/app/receipts/[id]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { setAssignments, addAssignments } from '@/lib/db/assignments'
import { explodeItem } from '@/lib/db/receipts'

export async function assignAction(
  receiptId: string,
  itemIds: string[],
  personIds: string[],
  mode: 'replace' | 'add',
) {
  if (mode === 'add') await addAssignments(itemIds, personIds)
  else await setAssignments(itemIds, personIds)

  revalidatePath(`/receipts/${receiptId}`)
  revalidatePath('/people')
}

export async function explodeItemAction(receiptId: string, itemId: string) {
  await explodeItem(itemId)
  revalidatePath(`/receipts/${receiptId}`)
}
```

- [ ] **Step 7: Build the receipt screen**

Create `src/app/receipts/[id]/ReceiptScreen.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Decimal } from '@/domain/money'
import { receiptTotals, unassignedItems, type AssignedItem } from '@/domain/shares'
import { ItemAssignmentList } from '@/components/ItemAssignmentList'
import { AssignSheet } from '@/components/AssignSheet'
import { Money } from '@/components/Money'
import { assignAction, explodeItemAction } from './actions'
import type { ItemRow, PersonRow, ReceiptRow } from '@/lib/db/types'

interface Props {
  receipt: ReceiptRow
  items: ItemRow[]
  people: PersonRow[]
}

export function ReceiptScreen({ receipt, items, people }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const assigned: AssignedItem[] = items.map((item) => ({
    id: item.id,
    netAmount: item.netAmount,
    assigneeIds: item.assigneeIds,
  }))

  const totals = receiptTotals(assigned)
  const outstanding = unassignedItems(assigned).length
  const net = items.reduce((sum, item) => sum.plus(item.netAmount), new Decimal(0))
  const nameOf = new Map(people.map((person) => [person.id, person.name]))

  function assign(personIds: string[], mode: 'replace' | 'add') {
    const itemIds = [...selected]
    setSheetOpen(false)
    startTransition(async () => {
      await assignAction(receipt.id, itemIds, personIds, mode)
      setSelected(new Set())
    })
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-32">
      <header>
        <h1 className="text-xl font-semibold">
          {receipt.merchant} {receipt.store && `· ${receipt.store}`}
        </h1>
        <p className="text-sm text-neutral-600">
          {receipt.purchasedOn} · {items.length} items · <Money value={net} /> ·
          paid by {nameOf.get(receipt.payerPersonId) ?? 'unknown'}
        </p>
      </header>

      {outstanding > 0 ? (
        <p className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900">
          {outstanding} item{outstanding === 1 ? '' : 's'} still unassigned. This
          receipt is not complete.
        </p>
      ) : (
        <p className="rounded-lg bg-green-50 p-3 text-green-900">
          Complete — every item has someone assigned.
        </p>
      )}

      <section className="rounded-lg border p-3">
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">Totals</h2>
        <ul>
          {[...totals.entries()].map(([personId, total]) => (
            <li key={personId} className="flex justify-between py-1">
              <span>{nameOf.get(personId) ?? 'unknown'}</span>
              <Money value={total} />
            </li>
          ))}
          {totals.size === 0 && (
            <li className="text-neutral-500">Nothing assigned yet.</li>
          )}
        </ul>
      </section>

      <ItemAssignmentList
        items={items}
        people={people}
        selected={selected}
        onSelectedChange={setSelected}
        onExplode={(itemId) =>
          startTransition(async () => {
            await explodeItemAction(receipt.id, itemId)
          })
        }
      />

      <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t bg-white p-4">
        <button
          type="button"
          onClick={() => setSelected(new Set(items.map((item) => item.id)))}
          className="rounded-lg border px-4 py-3"
        >
          All
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          onClick={() => setSheetOpen(true)}
          className="flex-1 rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : `Assign ${selected.size} selected`}
        </button>
      </div>

      {sheetOpen && (
        <AssignSheet
          people={people}
          count={selected.size}
          onAssign={assign}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  )
}
```

Create `src/app/receipts/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 8: Verify by hand**

Run `npm run dev` and open the receipt saved in Task 10.
Expected flow, and check each: red "34 items still unassigned" banner → press "All" → Assign → tick yourself → "Assign to exactly these 1" → banner turns green and Totals shows your name at 191,22 € → tick the BEBIDAS category header → Assign → tick Ana and Bruno and yourself → "Assign to exactly these 3" → the drinks show "Ana, Antonio, Bruno" and the three totals now reflect the split.

- [ ] **Step 9: Commit**

```bash
git add src/components src/app/receipts
git commit -m "feat: add receipt view with bulk item assignment"
```

---

## Task 13: Person view, settlements, and the receipt list

Closes the loop: what one person owes across every receipt, recording that they paid, and a home screen listing receipts.

**Files:**
- Create: `src/app/people/[id]/page.tsx`
- Create: `src/app/people/[id]/PersonScreen.tsx`
- Create: `src/app/people/[id]/actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx` (add navigation)

**Interfaces:**
- Consumes: `sharesForPerson`, `listSettlements`, `recordSettlement`, `balanceFor`, `listReceipts`.
- Produces: `recordSettlementAction(personId: string, amount: string, settledOn: string, note: string)`.

- [ ] **Step 1: Write the settlement action**

Create `src/app/people/[id]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { Decimal, parsePtDecimal, MoneyParseError } from '@/domain/money'
import { recordSettlement } from '@/lib/db/people'

export async function recordSettlementAction(
  personId: string,
  amount: string,
  settledOn: string,
  note: string,
) {
  let parsed: Decimal
  try {
    parsed = parsePtDecimal(amount)
  } catch (error) {
    if (error instanceof MoneyParseError) return { error: 'Enter an amount like 23,40.' }
    throw error
  }

  if (parsed.isZero()) return { error: 'A settlement cannot be zero.' }

  try {
    await recordSettlement(personId, parsed, settledOn, note)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record it.' }
  }

  revalidatePath(`/people/${personId}`)
  revalidatePath('/people')
}
```

- [ ] **Step 2: Build the person screen**

Create `src/app/people/[id]/PersonScreen.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Decimal } from '@/domain/money'
import { Money } from '@/components/Money'
import { recordSettlementAction } from './actions'
import type { SettlementRow } from '@/lib/db/types'

export interface ShareLine {
  itemId: string
  description: string
  receiptId: string
  merchant: string
  purchasedOn: string
  share: Decimal
}

interface Props {
  personId: string
  name: string
  shares: ShareLine[]
  settlements: SettlementRow[]
  shareTotal: Decimal
  settledTotal: Decimal
  balance: Decimal
}

export function PersonScreen({
  personId,
  name,
  shares,
  settlements,
  shareTotal,
  settledTotal,
  balance,
}: Props) {
  const [amount, setAmount] = useState(balance.toDecimalPlaces(2).toString().replace('.', ','))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function settle(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await recordSettlementAction(
        personId,
        amount,
        new Date().toISOString().slice(0, 10),
        note,
      )
      if (result?.error) {
        setError(result.error)
        return
      }
      setError('')
      setNote('')
    })
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-3xl font-semibold tabular-nums">
          <Money value={balance} className={balance.isNegative() ? 'text-green-700' : ''} />
        </p>
        <p className="text-sm text-neutral-600">
          <Money value={shareTotal} /> in shares less <Money value={settledTotal} /> settled
          {balance.isNegative() && ' — they are in credit'}
        </p>
      </header>

      <form onSubmit={settle} className="flex flex-col gap-2 rounded-lg border p-3">
        <h2 className="text-sm font-semibold text-neutral-600">Record a settlement</h2>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="w-28 rounded border p-2 text-right text-base tabular-nums"
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            className="flex-1 rounded border p-2 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black p-3 text-white disabled:opacity-50"
        >
          {pending ? 'Recording…' : 'Record'}
        </button>
        {error && <p className="text-red-700">{error}</p>}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">
          Settlements ({settlements.length})
        </h2>
        <ul>
          {settlements.map((settlement) => (
            <li key={settlement.id} className="flex justify-between border-b py-2">
              <span>
                {settlement.settledOn}
                {settlement.note && ` · ${settlement.note}`}
              </span>
              <Money value={settlement.amount} />
            </li>
          ))}
          {settlements.length === 0 && (
            <li className="py-2 text-neutral-500">Nothing settled yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-600">
          Shares ({shares.length} items)
        </h2>
        <ul>
          {shares.map((share) => (
            <li key={share.itemId} className="flex items-center gap-2 border-b py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate">{share.description}</p>
                <Link
                  href={`/receipts/${share.receiptId}`}
                  className="text-xs text-neutral-500 underline"
                >
                  {share.merchant} · {share.purchasedOn}
                </Link>
              </div>
              <Money value={share.share} className="text-sm" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
```

Create `src/app/people/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { Decimal } from '@/domain/money'
import { balanceFor } from '@/domain/shares'
import { listPeople, listSettlements, sharesForPerson } from '@/lib/db/people'
import { PersonScreen } from './PersonScreen'

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [people, shares, settlements] = await Promise.all([
    listPeople(),
    sharesForPerson(id),
    listSettlements(id),
  ])

  const person = people.find((candidate) => candidate.id === id)
  if (!person) notFound()

  const shareTotal = shares.reduce((sum, share) => sum.plus(share.share), new Decimal(0))
  const settledTotal = settlements.reduce(
    (sum, settlement) => sum.plus(settlement.amount),
    new Decimal(0),
  )

  return (
    <PersonScreen
      personId={person.id}
      name={person.name}
      shares={shares}
      settlements={settlements}
      shareTotal={shareTotal}
      settledTotal={settledTotal}
      balance={balanceFor(shareTotal, settledTotal)}
    />
  )
}
```

- [ ] **Step 3: Build the receipt list as the home page**

Replace `src/app/page.tsx`:

```tsx
import Link from 'next/link'
import { listReceipts } from '@/lib/db/receipts'
import { Money } from '@/components/Money'

export default async function HomePage() {
  const receipts = await listReceipts()

  return (
    <main className="flex flex-col gap-4 p-4">
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
```

- [ ] **Step 4: Add bottom navigation**

In `src/app/layout.tsx`, wrap `{children}` with a persistent nav:

```tsx
<body className="pb-16">
  {children}
  <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-white">
    <a href="/" className="flex-1 p-4 text-center">Receipts</a>
    <a href="/people" className="flex-1 p-4 text-center">People</a>
    <a href="/import" className="flex-1 p-4 text-center">Import</a>
  </nav>
</body>
```

Note: the receipt and import screens already reserve bottom space with `pb-28`/`pb-32` for their own action bars; increase those to `pb-40` so the nav does not cover the buttons.

- [ ] **Step 5: Verify the whole loop by hand**

1. `/` lists the imported receipt with its total and no "unassigned" warning.
2. Tap through to the receipt, confirm the totals.
3. `/people` shows Ana with a non-zero balance.
4. Tap Ana → her shares list every item she is on, each at the divided amount.
5. Record a settlement for her full balance → balance becomes 0,00 €.
6. Go back to the receipt, unassign Ana from one item, return to her page → she is now in credit, shown in green.

Step 6 is the ADR-0003 behaviour. If her balance instead stayed at zero, settlements are being treated as a flag somewhere and that is a defect.

- [ ] **Step 6: Run the full suite and type check**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all PASS, production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app
git commit -m "feat: add person balances, settlements and receipt list"
```

---

## Task 14: Deploy to Vercel

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a live URL.

- [ ] **Step 1: Write the README**

Create `README.md` covering: what the app is (one paragraph, pointing at `docs/spec.md` and `CONTEXT.md`), the transcription workflow (photograph the receipt, paste it into Claude asking for the seven-column CSV described in the spec, name the file `<merchant>_<store>_<DD-MM-YYYY>.csv`, upload it), local setup (`npm install`, copy `.env.local.example`, `npm run dev`), and `npm test`.

- [ ] **Step 2: Push to a Git remote**

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

- [ ] **Step 3: Deploy**

Import the repository in Vercel. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables for all environments. Deploy.

- [ ] **Step 4: Add the production redirect URL to Supabase**

In Authentication → URL Configuration, add `https://<your-app>.vercel.app/auth/callback` and set the Site URL to the production origin. Without this the magic link bounces to localhost.

- [ ] **Step 5: Verify on an actual phone**

Open the URL on your phone, sign in via the emailed link, import the sample CSV, assign a category to two people, and record a settlement.
Expected: every step works with no horizontal scrolling and tap targets large enough to hit one-handed. Note anything that feels wrong; those become the next round of work, not scope creep now.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and transcription workflow"
git push
```

---

## Verification checklist

Before calling this done, confirm each against the spec:

- [ ] Uploading `super_bairro_centro_24-08-2026.csv` yields 34 items totalling 191,22 € and a green reconciliation banner (spec §1–4).
- [ ] Deleting a line makes the banner red, states both figures and the difference, and still allows saving (spec §4).
- [ ] A file with a malformed row is rejected with a message naming the row (spec §2).
- [ ] Metadata prefills as Super Bairro / Centro / 2026-08-24 and is editable; a file named `receipt.csv` imports fine with blank fields (spec §3).
- [ ] Explode is offered on `CERVEJA LOIRA 30X25CL` (count 3) and not on `PORCO BIFANAS/ASSAR` (weight) (spec §7).
- [ ] The two identical `BOVINO HAMBURG 120G` rows exist as two separate items (spec, Transcription format).
- [ ] A receipt with any unassigned item shows the red incomplete banner (spec §11).
- [ ] Selecting the BEBIDAS category header selects exactly its items, and one Assign action applies to all of them (spec §12).
- [ ] Every money column in `supabase/migrations/0001_initial_schema.sql` is `numeric`, and `grep -rn "parseFloat\|Number(" src/domain` returns nothing in the money path (spec §14, Global Constraints).
- [ ] A €10,00 item split three ways displays 3,33 € per person and this is left alone (spec §15, ADR-0002).
- [ ] Unassigning someone after they settled puts them in credit rather than back to zero (spec §19, ADR-0003).
- [ ] The verification screen can add a line and delete a line, and both survive saving (spec §5).
- [ ] Exploding an item on an already-saved receipt splits it and keeps its existing assignees (spec §8).
- [ ] A person can be renamed inline, and the Owner has no Delete button (spec §9).
- [ ] Every amount displayed anywhere uses `pt-PT` EUR formatting via `formatEuro` (spec §16).
- [ ] A new receipt defaults its Payer to the Owner and lets you change it (spec §17).
- [ ] `npm test` and `npx tsc --noEmit` both pass.
