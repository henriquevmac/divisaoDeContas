# Receipts enter the app as a hand-made CSV, not a photo

The obvious design is to photograph a receipt in the app and have a vision model
extract the items, but we deliberately do not do this: the operator pastes the
photo into a separate Claude conversation, gets a CSV back, and uploads that. This
keeps the app itself free of any model API, key, per-scan cost or hallucinated
price, and makes Import a deterministic, fully testable pure function.

The cost is a manual step outside the app, and a Transcription that can still be
wrong — which is why Verification and Reconciliation exist. The parser sits behind
a boundary that produces a normalised list of Lines, so an in-app photo path can
later be added as a second producer without changing anything downstream.
