# API contracts

Base URL: `/api`

| Method | Path | Purpose | Initial response |
| --- | --- | --- | --- |
| GET | `/health` | Check API availability | `{ "status": "ok", "service": "payleak-api" }` |
| GET | `/invoices` | List invoices for the authenticated user | To be defined |
| POST | `/invoices` | Create an invoice | To be defined |
| GET | `/analytics/leaks` | Summarize estimated payment leakage | To be defined |
| POST | `/routes/compare` | Compare payment routes | To be defined |
| POST | `/ai/chat` | Ask a question about supplied account data | To be defined |

All non-health endpoints require authentication once the auth module is implemented.
Request and response schemas, error codes, and pagination conventions must be agreed
by the frontend and backend owners before implementation.
