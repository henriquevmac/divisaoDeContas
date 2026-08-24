# Divisão de Contas — Specification

Terms in Capitals are defined in [CONTEXT.md](../CONTEXT.md). Decisions with
lasting consequences are recorded in [docs/adr/](./adr/).

## Purpose

A single-user mobile web app that takes a CSV Transcription of a shopping receipt,
lets the Owner verify it, saves it as a Receipt with Items, and then divides those
Items among People so each Person's Balance can be tracked and settled.

## Users

One human: the Owner (`henriquevmac@gmail.com`). Other People never sign in — they are
labels the Owner creates. There are no groups, teams or invitations.

## The Transcription format

Produced by pasting a receipt photo into a Claude conversation outside the app.
Semicolon-delimited UTF-8, Portuguese decimal comma. Header row:

```
Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido
```

Data rows, e.g.:

```
MERCEARIA + PET FOOD;ARROZ CAROLINO;3;1,15;3,45;0,00;3,45
TALHO;PORCO BIFANAS/ASSAR;1,532;4,99;7,64;0,76;6,88
```

Final Total Line, with an empty Categoria and `TOTAL` as the Artigo:

```
;TOTAL;;;233,15;41,93;191,22
```

Properties the app must handle:

- `Quantidade` is either a count (`3`, `6,000`) or a weight in kilograms
  (`1,532`, `0,436`). A quantity whose value is a whole number is a count;
  anything else is a weight.
- Per-line discounts, sometimes large (`16,99` gross → `3,99` net).
- Exact duplicate rows are legitimate and must remain separate Items.
- Merchant, store and date appear only in the filename:
  `<merchant>_<store>_<DD-MM-YYYY>.csv`, e.g. `super_bairro_centro_24-08-2026.csv`.

## Functional requirements

### Import and Verification

1. The Owner uploads a `.csv` file. Parsing happens client-side; nothing is
   written to the database during Import (see ADR-0001).
2. The app parses every data row into a Line and the Total Line into stated
   totals. A malformed file is rejected with a message naming the offending row.
3. Receipt metadata (merchant, store, date) is prefilled by parsing the filename
   and is freely editable. A filename that does not match the pattern is not an
   error — the fields are simply left blank.
4. Reconciliation compares the sum of Line Net Amounts against the stated net
   total. A mismatch shows a prominent warning stating both figures and the
   difference. **It never blocks saving.**
5. The Verification screen shows every Line in an editable table, and allows
   editing any field, deleting a Line, and adding a Line.
6. Confirming Verification writes the Receipt, its Items, and the raw CSV in one
   transaction.

### Items

7. An Item whose Quantity is a count and greater than one can be Exploded into
   that many Items of quantity one, dividing gross, discount and net between
   them. Explode is unavailable on weight Items and on quantity-one Items.
8. Explode is available both during Verification and afterwards on a saved
   Receipt.

### People and Assignment

9. The Owner can create, rename and delete People. Exactly one Person is flagged
   as the Owner; that Person cannot be deleted.
10. Every Item has zero or more Assignments. An Item's Net Amount is divided
    equally among its assignees — every assignee bears an identical Share
    regardless of consumption.
11. A Receipt is Complete when every one of its Items has at least one
    Assignment. Items with no Assignment are an error state shown prominently;
    they are never charged implicitly to the Owner.
12. Assignment UI: rows are selectable, Category headers select all rows in that
    Category, and a single "Assign to…" action applies a set of People to every
    selected Item. A progress indicator shows how many Items remain unassigned.
13. People are chosen fresh for each Receipt. There are no saved groups.

### Money

14. All monetary values are stored as Postgres `NUMERIC` and manipulated as
    arbitrary-precision decimals — never as floats.
15. A Share is the Item's Net Amount divided by the number of its Assignments,
    rounded only at display time. Displayed Shares are therefore permitted not to
    sum exactly to the Item total (see ADR-0002). This is accepted behaviour.
16. Money is displayed in `pt-PT` EUR format.

### Settlement and Balances

17. Each Receipt records a Payer, defaulting to the Owner Person.
18. A Settlement records a Person, an amount and a date. It is never a boolean
    flag (see ADR-0003).
19. A Person's Balance is the sum of their Shares across all Receipts minus the
    sum of their Settlements. A negative Balance is shown as credit.
20. The Receipt view lists each Person's total for that Receipt. The Person view
    lists their Shares by Receipt, their Settlements, and their Balance.

## Non-functional requirements

- Mobile-first; the primary device is a phone. Desktop must work but is secondary.
- Authentication is Supabase magic link. Every row is owned by a Supabase user id
  and protected by row-level security.
- No model API, API key, or per-scan cost inside the application.

## Explicitly out of scope for v1

- In-app photo capture or OCR (the parser boundary leaves room for it later).
- Multiple accounts, shared groups, invitations, notifications.
- Weighted or explicit-amount splits — equal shares only.
- Partial payments against a specific Receipt; Settlements are per Person.
