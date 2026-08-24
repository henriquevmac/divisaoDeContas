# Schema

Five tables, all in the `public` schema, all protected by row-level security on
`owner_user_id = auth.uid()`. Terms in Capitals are defined in
[CONTEXT.md](../CONTEXT.md).

Every monetary column is `numeric(12, 4)` — never `float`. Four decimal places
rather than two because a Share is an exact quotient (a €10,00 Item split three
ways is 3.3333…), and the extra scale lets a divided amount survive a round trip
without being silently rounded on write. Display rounds to two places; the
resulting drift is accepted deliberately (see
[ADR-0002](./adr/0002-decimal-money-with-accepted-display-drift.md)).

## `people`

One row per Person. `is_owner` marks the Owner and is constrained to exactly one
row per user by the partial unique index `people_one_owner_per_user`. Names are
unique per user, case-insensitively. People never sign in — they have no
`auth.users` row of their own; `owner_user_id` is the account they belong to.

## `receipts`

One shopping trip. `payer_person_id` is the Payer, defaulting in the UI to the
Owner but free to be anyone. `source_filename` and `source_csv` retain the
original Transcription so a bad import can be re-parsed without redoing the
Claude step. `stated_gross` / `stated_discount` / `stated_net` come from the
Transcription's Total Line and are kept so Reconciliation can be re-checked
later; they are nullable because a Transcription need not carry a Total Line.

## `items`

One saved Item, ordered within its Receipt by `position`. `quantity_kind` is
constrained to `'count'` or `'weight'` and decides whether the Item can be
Exploded. `net_amount` is the figure that gets divided; `gross_amount` and
`discount` are retained for display only.

## `assignments`

The many-to-many between `items` and `people`, keyed on both columns so a Person
cannot be assigned twice to the same Item. An Item's cost divides equally among
its rows here. No row means Unassigned, which is an error state rather than an
implicit charge to the Owner.

## `settlements`

A recorded amount handed over on a date — never a boolean flag, so that editing
an Assignment after settling surfaces as a credit rather than silently changing
what "settled" meant (see
[ADR-0003](./adr/0003-settlement-is-a-recorded-amount.md)). A Person's Balance is
the sum of their Shares minus the sum of these amounts.

## Functions

`save_verified_receipt(...)` inserts a Receipt and all of its Items in one
transaction, taking the Items as a `jsonb` array. It exists because the Supabase
JS client cannot issue multi-statement transactions, and a half-written Receipt
would be worse than a failed import. It is `security invoker`, so row-level
security still applies to the caller.
