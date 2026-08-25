# Divisão de Contas

A single-user mobile web app for splitting the cost of a shopping receipt among a
group of people. A receipt is imported from a CSV transcription, verified by hand,
and then its items are assigned to people so that each person's share can be
tracked and settled.

## Language

### Importing

**Transcription**:
A CSV file describing one receipt, produced by pasting a photo of that receipt into
a Claude conversation outside the app. It is untrusted input — it may misread,
drop, or invent lines.
_Avoid_: Export, scan, OCR output

**Import**:
The act of turning a Transcription into a draft Receipt for verification. An Import
never writes items directly to the database.
_Avoid_: Upload, parse

**Verification**:
The screen on which the operator reviews and corrects a draft Receipt — its
metadata and every Line — before it is saved. Nothing exists in the database until
Verification is confirmed.
_Avoid_: Review, confirmation, preview

**Reconciliation**:
The check that the Lines of a draft Receipt sum to the amount stated on its Total
Line. A failed Reconciliation warns but never blocks Verification.
_Avoid_: Validation, checksum

**Total Line**:
The final row of a Transcription, which states the receipt's own gross, discount
and net totals. It is not a Line and never becomes an Item.

### The receipt

**Receipt**:
One shopping trip at one merchant on one date, paid by one person. It owns its
Items and is the unit in which cost is divided.
_Avoid_: Bill, purchase, transaction, ticket

**Line**:
A single row of a Transcription, before it has been verified and saved.
_Avoid_: Row, entry

**Item**:
One saved thing on a Receipt, carrying a description, a Category, a quantity and a
Net Amount. It is the smallest thing that can be assigned to people.
_Avoid_: Product, article, artigo, line item

**Category**:
The merchant's own grouping of an Item, taken verbatim from the Transcription
(`BEBIDAS`, `TALHO`, `MERCEARIA + PET FOOD`). Categories are per-Receipt labels and
are never normalised into a shared taxonomy across merchants. Used to select many
Items at once.
_Avoid_: Type, department, section

**Net Amount**:
What an Item actually cost after its discount — the amount that gets divided. The
gross amount and the discount are also kept, but only for display.
_Avoid_: Price, cost, value, valor

**Quantity**:
How much of an Item was bought. It is either a count of units (`3`) or a weight in
kilograms (`1,532`). Only a count can be Exploded.

**Explode**:
To replace one Item of quantity N with N Items of quantity one, dividing its Net
Amount between them, so that units of the same product can go to different people.
Only available on Items whose Quantity is a count.
_Avoid_: Split (reserved for dividing cost between people), expand

### Dividing the cost

**Person**:
Someone who can be assigned Items and carries a Balance. Exactly one Person is the
Owner. People do not have accounts and never sign in.
_Avoid_: User, member, participant, friend

**Owner**:
The Person who is the operator of the app. The default Payer of a Receipt, and the
Person against whom every Balance is read.
_Avoid_: Me, self, admin

**Payer**:
The Person who actually paid a Receipt. Usually the Owner, but not necessarily.

**Assignment**:
The fact that a Person is one of the people responsible for an Item. An Item's
Assignments are what divide its cost. People are chosen individually for each
Receipt; there is no saved group.
_Avoid_: Allocation, tag, claim

**Share**:
A Person's portion of an Item's Net Amount — the Net Amount divided equally among
that Item's Assignments. Every Person on an Item bears an equal Share regardless of
how much they consumed.
_Avoid_: Portion, split, cut

**Complete**:
A Receipt every one of whose Items has at least one Assignment. An Item with no
Assignments is an error to be corrected, never an implicit charge to the Owner.
_Avoid_: Done, finished, closed

**Settlement**:
A record that one Person handed a specific amount to another Person on a
specific date. It is a recorded amount, never a flag, so it stays truthful when
Assignments change afterwards.
_Avoid_: Payment, settling up, reimbursement

**Counterparty**:
The other Person in a Debt or a Settlement — whoever is owed, or whoever was
paid.
_Avoid_: Creditor, debtor, other party

**Debt**:
What one Person owes their Counterparty, netted across both directions: the
Shares they ran up on Receipts the Counterparty paid, less the Shares the
Counterparty ran up on Receipts they paid, less what has already been Settled
between them. A negative Debt means they are owed rather than owing. Two People
with a Debt of zero are Square.
_Avoid_: Owed, IOU

**Balance**:
A Person's Debt with one particular Counterparty. There is no single figure for
a Person on their own — what they owe depends on whom you are asking about.
_Avoid_: Total, running total

**Square**:
Two People with a Debt of zero between them. Being Square with one Person says
nothing about any other.
_Avoid_: Settled (which describes a Settlement, not a state), paid up, even
