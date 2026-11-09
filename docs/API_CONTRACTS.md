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
| GET | `/transactions/:id/fee-breakdown` | Get actual fee details or report unavailable |
| GET | `/transactions/:id/currency-breakdown` | Get currency conversion and payout details |
| GET | `/clients` | List the user's clients |
| POST | `/clients` | Create a client |
| GET | `/clients/:id` | Get one client |
| PUT | `/clients/:id` | Update a client |
| DELETE | `/clients/:id` | Delete a client |
| GET | `/invoices` | List the user's invoices |
| POST | `/invoices` | Create a draft invoice |
| POST | `/invoices/paypal/diagnostics` | Verify PayPal OAuth, invoice-read scope, and the first Invoicing API page |
| POST | `/invoices/sync-paypal` | Import/update all PayPal invoices for the authenticated configured owner |
| GET | `/invoices/:id` | Get one invoice |
| PUT | `/invoices/:id` | Update an invoice |
| DELETE | `/invoices/:id` | Delete an unpaid invoice |
| POST | `/invoices/:id/send` | Currently reports unavailable; no invoice is sent |
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

AI chat accepts `{ "question": "...", "history": [{ "role": "user|assistant", "text": "..." }] }`.
The backend fetches transactions, invoices, and currency conversions using the
authenticated user's ID and sends only those records plus recent conversation turns
to Google Gemini. Conversation history is kept in the current frontend session and
is not stored in MongoDB. Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the backend
environment (`gemini-3.5-flash-lite` by default; `gemini-2.5-flash` was not
available to this AI Studio key when verified). Diagnostics makes a minimal Gemini
request and returns provider, model, and connectivity status; it never returns the
API key.

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
PayPal invoice import uses the separate Invoicing API
`GET /v2/invoicing/invoices?page=1&page_size=100&total_required=true` and requires
the `https://uri.paypal.com/services/invoicing/invoices/read` OAuth scope. It
paginates all returned pages and upserts by authenticated `userId` plus PayPal
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
