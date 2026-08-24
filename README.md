# Divisão de Contas

A single-user mobile web app for splitting the cost of a shopping receipt among
a group of people. Import a receipt as CSV, verify it, then assign each item to
whoever it belongs to and track what everyone owes.

- [`CONTEXT.md`](./CONTEXT.md) — the vocabulary. Read this first.
- [`docs/spec.md`](./docs/spec.md) — what the app does and deliberately does not do.
- [`docs/adr/`](./docs/adr/) — decisions that would otherwise look surprising.
- [`SETUP.md`](./SETUP.md) — first-time Supabase setup.

## How a receipt gets in

The app contains no vision model and no LLM API. Transcription happens outside
it, which keeps importing deterministic, free, and testable
([ADR-0001](./docs/adr/0001-csv-transcription-instead-of-in-app-ocr.md)):

1. Photograph the receipt and paste the photo into a Claude conversation, asking
   for a `;`-delimited CSV with these columns:

   ```
   Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido
   ```

   and a final row `;TOTAL;;;<gross>;<discount>;<net>`.

2. Save it as `<merchant>_<store>_<DD-MM-YYYY>.csv`, e.g.
   `super_bairro_centro_24-08-2026.csv`. The app reads the merchant, store and date
   from that name, and you can correct them before saving.

3. Upload it at `/import`. The app checks the item lines against the receipt's
   own `TOTAL` row and warns loudly if they disagree — that is your defence
   against a misread digit or a dropped line. It never blocks you.

4. Confirm. Only then is anything written to the database.

The transcription is untrusted input: verification is the point, not a
formality. A copy of the original CSV is stored with the receipt so a bad import
can be re-parsed without redoing the Claude step.

## Splitting

Each item's net amount (after discount) divides equally among the people
assigned to it. For quantities that need to go to different people — three
crates of beer, two of them yours — use **Explode** to split the line into
single units first. Weight lines cannot be exploded.

A receipt is complete only when every item has someone assigned; unassigned
items are an error, never an implicit charge to you.

Settling records an amount and a date rather than a flag, so editing an old
receipt after settling shows up as a credit instead of silently changing what
"settled" meant.

## Project layout

```
CONTEXT.md            glossary
docs/                 spec, ADRs, schema notes, implementation plan
supabase/migrations/  schema and the save_verified_receipt function
web/                  the Next.js application
  src/domain/         pure logic: parsing, money, explode, shares. No I/O.
  src/lib/db/         Supabase queries and the Server → Client wire types
  src/app/            routes
  src/components/     shared UI
```

`src/domain/` has no dependency on React, Next or Supabase and carries the bulk
of the tests. Money is `decimal.js` throughout and `numeric` in Postgres — never
a float.

## Local development

```bash
cd web
npm install
cp .env.local.example .env.local   # then fill it in — see SETUP.md
npm run dev
```

```bash
npm test          # Vitest
npm run build     # production build
npx tsc --noEmit  # type check
```

## Deployment

Vercel, with the project's **Root Directory set to `web`** — the app is not at
the repository root. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` for all environments, and add
`https://<your-app>.vercel.app/auth/callback` to the Supabase redirect URLs.
