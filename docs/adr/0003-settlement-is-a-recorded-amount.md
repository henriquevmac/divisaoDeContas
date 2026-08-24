# Settlement records an amount, not a settled flag

Marking a Person settled writes a Settlement row holding the amount handed over
and the date, and a Balance is computed as the sum of that Person's Shares minus
the sum of their Settlements. There is no boolean "settled" state anywhere.

We chose this because Receipts stay editable after settling. With a flag,
reassigning an Item on an already-settled Receipt silently changes what the flag
was supposed to mean and an overpayment disappears without trace; with recorded
amounts the same edit simply surfaces as a negative Balance, which is visible and
correctable. The cost is that "is this settled?" is a computation rather than a
column.
