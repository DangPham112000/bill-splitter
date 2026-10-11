# Bill Splitter

Split the costs of a trip, project or party. Members join through a link without signing in, record what they paid and received, and the app works out who pays whom with the fewest transfers. Amounts are in VND.

## Stack

pnpm monorepo, the same stack as Event Manager:

- `frontend/`: React 19, Vite, TypeScript, Tailwind CSS, Apollo Client
- `backend/`: Node.js, Express, Apollo Server (GraphQL), Mongoose
- MongoDB 7
- `nginx/`: serves the built frontend and proxies `/graphql` and `/health` to the backend
- Clerk (optional sign-in) is added in a later task.

## Data model

Collections, fields and indexes are described in [docs/data-model.md](docs/data-model.md). Money is always stored as whole VND.

## Run locally

Requirements: Node.js 22+, pnpm 10 (`corepack enable`), Docker.

### Hot reload (day-to-day development)

```sh
pnpm install
docker compose up -d mongodb   # MongoDB on localhost:27017
pnpm dev                       # backend on :4000, frontend on :5173
```

Open http://localhost:5173. Vite proxies `/graphql` and `/health` to the backend.
The backend reads `backend/.env` if present; copy `backend/.env.example` to change the defaults.

### Whole app in Docker

```sh
docker compose up --build
```

Open http://localhost:8080 (set `APP_PORT` to use another port).

## Health check

`GET /health` returns `200` with `{"status":"ok","database":"connected"}`, or `503` with `"degraded"` while MongoDB is unreachable. The same data is available as the GraphQL query `{ health { status database time } }`.

## Scripts

| Command             | What it does                           |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Run backend and frontend in watch mode |
| `pnpm build`        | Build both packages                    |
| `pnpm lint`         | ESLint across the repo                 |
| `pnpm typecheck`    | TypeScript checks for both packages    |
| `pnpm format`       | Format with Prettier                   |
| `pnpm format:check` | Check formatting                       |
