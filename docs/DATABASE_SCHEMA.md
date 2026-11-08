# Database schema

The backend uses MongoDB through Mongoose and explicitly selects the `payleak`
database, regardless of whether the URI contains a database path. Every
user-owned record is queried with its `userId`; PayPal transaction
synchronization is restricted to the explicitly configured merchant owner.
Amounts and exchange rates are stored as decimal strings so financial
arithmetic does not depend on binary floating point.

## Active backend collections

- **User** — normalized unique email, display name, and password hash.
- **Client** — user-owned client contact details.
- **Invoice** — user-owned client, amount/currency, invoice and due dates,
  status, and optional PayPal invoice identifier.
- **Transaction** — user owner, PayPal transaction ID, gross and actual fee
  amount/currency/source, conversion and payout fields, transaction date/status,
  retrieval timestamp, financial-data completeness, and retained raw PayPal
  payload. A unique index covers `(userId, paypalTransactionId)`.
- **PayPalAccount** — user owner, configured merchant identifiers/environment,
  verified capability flags, and last synchronization time.
- **PayPalOrder** — user owner, idempotency keys, Sandbox order/capture IDs,
  requested amount and currency, order state, and approval URL. Client secrets
  and buyer/card details are not stored.
- **PayPalExchangeRateQuote** — stored PayPal quote/rate records with direction,
  amount, currency, and source metadata.
- **CurrencyConversion** — conversion records referencing the quote/source and
  direction used.
- **FeeSchedule** — source and effective-dated fee information; no unverified
  schedule is seeded.
- **Notification** — user owner, category, content, read timestamp, and
  deduplication key.
- **WebhookEvent** — PayPal event ID and verified event data for idempotent
  processing.

The legacy scaffold includes additional model files (for approvals, audit logs,
reference rates, and route quotes). They are not mounted into the current API
flow. Route optimization is not part of the current frontend experience.
