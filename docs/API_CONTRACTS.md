# API contracts

Base URL: `/api`. Successful JSON responses use `{ "success": true, "data": ... }`.
Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`.
Authenticated browser requests use the `payleak_access` HTTP-only JWT cookie.
API clients may also supply a JWT in the `Authorization` header. Health,
authentication, and PayPal webhook endpoints do not require a user session.
Monetary amounts are decimal strings. The API does not substitute estimated
fees or rates.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | API and MongoDB availability, including active database name when connected |
| POST | `/auth/register` | Register a user, set the HTTP-only session cookie, and return the user |
| POST | `/auth/login` | Authenticate, set the HTTP-only session cookie, and return the user |
| GET | `/auth/me` | Return the authenticated user's profile |
| PUT | `/auth/me` | Update the authenticated user's name and email |
| POST | `/auth/logout` | Clear the HTTP-only session cookie |
| GET | `/paypal/connect` | Currently reports unavailable until an approved partner integration is configured |
| GET | `/paypal/config` | Report configured environment and whether Sandbox Checkout credentials are configured; no secrets returned |
| GET | `/paypal/account` | Get the authenticated user's stored PayPal account status |
| POST | `/paypal/diagnostics` | Check app OAuth and Transaction Search permission separately; returns no token or transaction contents |
| POST | `/paypal/sync` | Sync configured owner's PayPal Transaction Search data |
| POST | `/paypal/orders` | Create an idempotent Sandbox Checkout order |
| POST | `/paypal/orders/:orderId/capture` | Verify buyer approval, capture server-side, and save the completed capture in MongoDB |
| POST | `/paypal/orders/:orderId/cancel` | Verify order state and record cancellation only for a PayPal-voided order |
| POST | `/paypal/webhook` | Verify and persist a PayPal webhook event |
| GET | `/transactions` | List the authenticated user's transactions (paginated/filterable) |
| POST | `/transactions/sync` | Sync PayPal transactions for the configured owner |
| GET | `/transactions/:id` | Get one transaction |
| POST | `/transactions/:id/refresh` | Refresh one transaction from PayPal Transaction Search and upsert the returned record |
| GET | `/transactions/:id/fee-breakdown` | Get actual fee details or report unavailable |
| GET | `/transactions/:id/currency-breakdown` | Get currency conversion and payout details |
| GET | `/analytics/transactions/:transactionId/ai-analysis` | Return PayPal-reported gross, fee, net, conversion, and payout values separately from deterministic PayLeak calculations, verification status, discrepancy reasons, and a cached transaction-specific Gemini explanation; authenticated and rate-limited. Add `?regenerate=true` to request a fresh explanation |
| GET | `/clients` | List the user's clients |
| POST | `/clients` | Create a client |
| GET | `/clients/:id` | Get one client |
| PUT | `/clients/:id` | Update a client |
| DELETE | `/clients/:id` | Delete a client |
| GET | `/invoices` | List the user's invoices |
| POST | `/invoices` | Create a PayPal Sandbox draft first, then save the confirmed invoice for the authenticated merchant owner |
| POST | `/invoices/paypal/diagnostics` | Verify PayPal OAuth, invoice API access, and the first Invoicing API page |
| POST | `/invoices/sync-paypal` | Retrieve PayPal invoice pages/details and import or update them for the configured owner |
| POST | `/invoices/:id/paypal` | Create an existing local draft in PayPal and link the confirmed PayPal invoice to that same MongoDB record |
| GET | `/invoices/:id` | Get one invoice |
| PUT | `/invoices/:id` | Update an invoice |
| DELETE | `/invoices/:id` | Delete an unpaid invoice |
| POST | `/invoices/:id/send` | Send a PayPal-confirmed draft and update local status only after PayPal confirms sending |
| GET | `/analytics` | Currency-separated dashboard metrics |
| GET | `/analytics/dashboard` | Dashboard metrics (alias) |
| GET | `/analytics/monthly` | Monthly gross totals by currency |
| GET | `/analytics/fees` | Verified actual fees grouped by currency |
| GET | `/analytics/clients` | Client metrics grouped by currency |
| GET | `/analytics/currencies` | Gross totals by currency |
| GET | `/analytics/leaks` | Actual fee and unavailable conversion/withdrawal details |
| GET | `/analytics/leaks/:transactionId` | Fee and currency breakdown for one transaction |
| GET | `/currency/paypal/rates` | List stored PayPal exchange-rate records |
| GET | `/currency/paypal/rates/:from/:to` | Get a stored PayPal rate |
| POST | `/currency/paypal/quote` | Currently unavailable; no quote is fabricated |
| POST | `/currency/paypal/calculate` | Calculate using an existing verified PayPal quote |
| GET | `/currency/paypal/fees` | List effective-dated verified fee schedules |
| GET | `/currency/paypal/conversions/:id` | Get a stored conversion |
| GET | `/notifications` | List the user's notifications |
| PATCH | `/notifications/read-all` | Mark all notifications read |
| PATCH | `/notifications/:id` | Set a notification's read state |
| DELETE | `/notifications/:id` | Delete a notification |
| POST | `/notifications/reminders/:invoiceId/draft` | Create a reminder draft without sending |
| POST | `/notifications/reminders/:invoiceId/send` | Currently unavailable; no email is sent |
| POST | `/ai/chat` | Ask the AI to explain stored financial data |
| POST | `/ai/assistant` | AI chat alias |
| POST | `/ai/diagnostics` | Test Google Gemini key availability, model, and API connectivity without returning credentials |

Transaction analysis uses only fields returned by PayPal Transaction Search and PayLeak's
deterministic decimal calculation. A calculated net is available only for a non-refund
transaction when the actual PayPal gross and fee use the same currency. Verification
statuses are `MATCH`, `MISMATCH`, `NOT_AVAILABLE`, or `NOT_APPLICABLE`; a PayPal refresh
updates the selected transaction from Transaction Search and does not infer a bank payout.

AI chat accepts `{ "question": "...", "history": [{ "role": "user|assistant", "text": "..." }] }`.
The backend fetches transactions, invoices, and currency conversions using the
authenticated user's ID and sends only those records plus recent conversation turns
to Google Gemini. Conversation history is kept in the current frontend session and
is not stored in MongoDB. Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the backend
environment (`gemini-3.5-flash-lite` by default; `gemini-2.5-flash` was not
available to this AI Studio key when verified). Diagnostics makes a minimal Gemini
request and returns provider, model, and connectivity status; it never returns the
API key.

Transaction AI analysis reads only the authenticated user's stored PayPal
transaction record. PayLeak calculates same-currency net-after-fee and fee
percentage using decimal arithmetic; Gemini only produces explanatory text,
insights, and recommendations and is not allowed to provide financial amounts.
Payer identity is omitted from the LLM prompt. Missing exchange-rate benchmarks,
withdrawal records, and bank settlement data remain unavailable rather than
being estimated. Pass `?regenerate=true` to request a fresh explanation.

`POST /paypal/orders` requires an `Idempotency-Key` UUID header and a validated
amount, currency, and description. The browser redirects the buyer to PayPal's
Sandbox approval page; the backend verifies the completed order/capture before
inserting its capture as a transaction. Merchant seller-consent linking is a
separate capability and remains unavailable without PayPal partner approval.
The API requires `PAYPAL_MODE=sandbox` with
`https://api-m.sandbox.paypal.com`, or the explicit `PAYPAL_MODE=live` with
`https://api-m.paypal.com`. The Checkout flow remains Sandbox-only.
Transaction Search uses the merchant's own REST app only after its permissions
are granted and a verified, immutable PayLeak owner user ID is configured.
Email matching is not an ownership proof. Connecting separate merchants
requires eligible PayPal partner seller-consent access; app client credentials
alone do not supply that authorization.

Invoice creation requires an authenticated user matching
`PAYPAL_ACCOUNT_OWNER_USER_ID`, Sandbox app credentials, and a UUID
`Idempotency-Key` header. The API calls `POST /v2/invoicing/invoices` before
writing to MongoDB, sends one line item using the submitted amount/currency,
and reports success only after PayPal returns a confirmed draft with an invoice
ID and status. Failed PayPal requests never fall back to local-only invoice
creation. Reuse the same idempotency key after a timeout.

Previously saved local-only draft invoices remain identifiable as
`source=payleak`. `POST /invoices/:id/paypal` creates the remote draft and links
its PayPal identifiers to that same MongoDB document. The sync operation is
import-only; it never pushes local drafts or sends invoices. Sending is a
separate `POST /v2/invoicing/invoices/{invoice_id}/send` request. PayLeak only
updates the local status after PayPal confirms the result and refreshes invoice
details/status from PayPal. The local update endpoint cannot override a
PayPal-linked invoice's status.

Invoice diagnostics report OAuth scope claims separately from actual Invoicing
API access. They do not create or send a test invoice; those mutating operations
can only be verified by a real operation. PayPal client-credentials does not
identify the merchant, so confirm the REST app's Sandbox Business association
in PayPal Developer Dashboard.

Postman Sandbox workflow:
1. Sign in with `POST /api/auth/login` and retain the HTTP-only cookie (or set a
   bearer JWT). Use the backend base URL `http://localhost:5000/api`.
2. Call `POST /api/invoices/paypal/diagnostics` with `{}`. Verify the Sandbox
   environment, configured owner, OAuth result, and invoice API HTTP status.
   OAuth alone does not verify invoice write access.
3. Call `POST /api/invoices` with a UUID `Idempotency-Key` header and a validated
   body, for example:
   `{ "client": "Sandbox Buyer", "email": "<Sandbox buyer email>", "amount": "10.00", "currency": "USD", "description": "Sandbox test service", "date": "2026-11-09", "due": "2026-11-16" }`.
   Success includes the PayPal invoice ID/number and confirmed status. On
   denial, inspect the sanitized PayPal error name, message, HTTP status, and
   debug ID; PayLeak does not create a local-only invoice.
4. To link an existing PayLeak-only draft, call
   `POST /api/invoices/{mongo_invoice_id}/paypal` with a UUID
   `Idempotency-Key`.
5. To send a confirmed draft, call
   `POST /api/invoices/{mongo_invoice_id}/send`. This emails the invoice to the
   Sandbox recipient; use only a Sandbox buyer address.
6. Call `POST /api/invoices/sync-paypal` twice. Compare PayPal's `total_items`,
   full detail retrieval count, MongoDB insert/update counts, and stored total.
   The second run should update existing IDs rather than insert duplicates.
PayPal invoice import uses the separate Invoicing API
`GET /v2/invoicing/invoices?page=1&page_size=100&total_required=true`. The token's
reported OAuth scope claims are shown separately from observed API access,
because successful Invoicing API requests may succeed when a scope is not listed
in the OAuth response. It paginates all returned pages and upserts by authenticated `userId` plus PayPal
invoice ID. Import does not create invoices in PayPal or delete local invoices.
The sync response reports OAuth app ID, scope/access diagnostics, page counts,
insert/update/duplicate totals, and the MongoDB invoice count without returning
credentials or access tokens. PayPal does not return the merchant identity for
client-credentials invoice-list requests; verify the REST app's Sandbox Business
association in the PayPal Developer Dashboard.
`POST /transactions/sync` accepts a date range of up to three years and queries
PayPal in consecutive 30-day windows, requesting `fields=all` and paging through
each response. Its result includes the OAuth app ID (never the client secret or
access token), per-page HTTP and result counts, inserted/refreshed/duplicate
counts, and MongoDB totals for the owner and requested date range. A successful
response reports only records actually returned by PayPal; the API does not
assert that the Sandbox account's Developer Dashboard history matches the
authorized REST app.

`GET /transactions` accepts `page`, `limit` (maximum 100), `from`, `to`,
`currency`, and `status` query parameters. Browser login/register responses do
not expose the JWT in JSON; the browser sends its HTTP-only cookie automatically.
Logout clears the cookie; there is no refresh-token system.
