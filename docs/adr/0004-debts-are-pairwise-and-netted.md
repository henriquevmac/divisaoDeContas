# Debts are pairwise between People, and netted

Every Receipt records a Payer, so a Share creates a Debt from the assignee to
whoever paid that Receipt — not to the Owner. A Person therefore has no single
balance: they have one Debt per Counterparty, each netted across both
directions so that Ana owing €30 on a Receipt you paid and you owing €20 on one
she paid resolves to "Ana owes you €10" rather than two figures to subtract by
hand.

Until now the Payer was stored and displayed but never used in any arithmetic,
and `Balance` was defined as what a Person owed the Owner. That was coherent
only while the Owner paid for everything; the moment anyone else paid, their
Debt was invisible. Recording a Payer we then ignored was the worse of the two
inconsistencies, so we made the arithmetic honour it rather than removing the
field.

The cost is that Settlement needed a Counterparty (migration
`0003_settlement_counterparty.sql`): "Ana paid €10" is ambiguous once more than
one Person can be owed. Existing Settlements were backfilled to the Owner, which
is what they meant. The migration deliberately has no `DELETE` for rows the
backfill cannot resolve — the `NOT NULL` fails loudly instead, because a
Settlement records money that actually changed hands and must never be discarded
silently.

Netted figures are shown as the headline with both gross directions expandable
underneath, since a single netted number is hard to trust without seeing what
produced it.
