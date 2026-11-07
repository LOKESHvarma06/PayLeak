# PayLeak

PayLeak is a payment analytics and fee leakage monitoring platform.

## Run the demo

```sh
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The frontend opens at Vite's local URL. Sign in with the prefilled demo account,
then select **Continue with sample data** on the PayPal setup screen. All accounts,
payments, invoices, and AI responses in this prototype are fictional; it does not
connect to PayPal or send money or email.

The dashboard links to invoices, money leak analysis, AI assistant, notifications,
and settings. Create an invoice to try the local draft extraction, preview, and
confirmation flow. Use Settings to reset browser-local demo records.

## Folder structure

- `frontend/` — React app and local demo experiences
- `backend/` — Express API and business logic
- `ai-service/` — AI prompts and extractors
- `docs/` — API and schema docs
- `tests/` — test folder

The frontend uses `VITE_API_MODE=demo` by default. Set `VITE_API_MODE=api` and
configure `VITE_API_BASE_URL` in `frontend/.env` to opt into available backend
endpoints. Until those endpoints are available, service functions use clearly
identified demo fixtures.

## Why controllers and services are separate

The backend route comparison API remains available for future use:
- `routeController.js` receives the request.
- `routeOptimizationService.js` calculates the routes.
- `RouteQuote.js` saves the result.
- The controller returns JSON to its API caller.

This keeps HTTP code, business logic, and storage concerns separate.
