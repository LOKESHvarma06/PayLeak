# PayLeak

PayLeak helps teams review payment fees, invoices, and payment routes.

## Project structure

- `frontend/` — React application
- `backend/` — Express API and application services
- `ai-service/` — AI prompt and response-generation modules
- `docs/` — API, data model, team, and demo documentation
- `tests/` — project-level tests

## Getting started

1. Install the root and application dependencies:

   ```sh
   npm install
   npm install --prefix frontend
   npm install --prefix backend
   ```

2. Copy `backend/.env.example` to `backend/.env` and add your local configuration.
   The frontend environment file is `frontend/.env`.
3. Start the frontend and backend together:

   ```sh
   npm run dev
   ```

The frontend runs on Vite's default development port. The API defaults to port
`5000`; its health endpoint is `GET /api/health`.

## Team ownership

- Frontend: Member 1
- Backend: Members 2 & 3
- AI service: Member 4

See the files in `docs/` for the working contracts and team task outline.
