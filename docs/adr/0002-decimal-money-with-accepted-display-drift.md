---
status: accepted
---

# Money is stored as exact decimals, and displayed Shares may not sum to the total

Money is stored as Postgres `NUMERIC` (never float), and a Share is stored as the
exact quotient of an Item's Net Amount by its number of Assignments. Rounding to
cents happens only at display time.

This means displayed figures do not always reconcile: €10,00 across three people
shows €3,33 each, and the three displayed Shares sum to €9,99 rather than €10,00.
Across a large receipt a person's displayed Balance can therefore sit a few cents
below the true figure. **This is a known and accepted consequence, not a bug — do
not "fix" individual roundings.**

Two alternatives were rejected: integer cents throughout, and decimal storage with
largest-remainder allocation at display. Both make displayed Shares sum exactly,
at the cost of an allocation rule that assigns leftover cents to an arbitrary
person. We chose to treat these numbers as guidance for splitting a household
shop rather than as figures anyone pays to the cent. If exact reconciliation is
ever needed, largest-remainder allocation at the display layer is the cheapest
route, since stored values are already exact.
