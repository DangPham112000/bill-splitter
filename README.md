# Bill Splitter

Split the costs of a trip, project or party. Members join through a link without signing in, record what they paid and received, and the app works out who pays whom with the fewest transfers. Amounts default to VND, and a splitter can use another currency such as THB or CNY.

## Stack

pnpm monorepo, the same stack as Event Manager:

- `frontend/`: React 19, Vite, TypeScript, Tailwind CSS, Apollo Client
- `backend/`: Node.js, Express, Apollo Server (GraphQL), Mongoose
- `shared/`: TypeScript used by both, such as the money helpers that format and parse amounts (`1.250.000 ₫`, `50k`, `1.2tr`). It builds on `pnpm install` and rebuilds in watch mode under `pnpm dev`.
- MongoDB 7
- `nginx/`: serves the built frontend and proxies `/graphql` and `/health` to the backend
- Clerk for optional sign-in, using the ecosystem's shared Clerk app (see [Sign-in](#sign-in))

## Data model

Collections, fields and indexes are described in [docs/data-model.md](docs/data-model.md). VND is the default currency and any other can be chosen per splitter; amounts are stored as integers in the currency's minor unit.

## Run locally

Requirements: Node.js 22+, pnpm 10 (`corepack enable`), Docker.

### Hot reload (day-to-day development)

```sh
pnpm install
docker run -d --name bill-splitter-mongo -p 127.0.0.1:27017:27017 mongo:7
pnpm dev   # backend on :4000, frontend on :5173
```

Open http://localhost:5173. Vite proxies `/graphql` and `/health` to the backend.
The backend reads `backend/.env` if present; copy `backend/.env.example` to change the defaults. Without Clerk keys the app runs signed out, which is enough for everything except creating a splitter.

### Whole app in Docker

```sh
docker compose up --build
```

Open http://localhost:8083 (set `APP_PORT` to use another port). This is the same `docker-compose.yml` that runs in production, so it needs the shared MongoDB from [ecosystem-infra](https://github.com/DangPham112000/ecosystem-infra) running first (it creates the `ecosystem` network and the `bill-splitter` Mongo user), and `MONGO_PASSWORD` set to that user's password.

## Sign-in

Sign-in is optional and never a gate: members join a splitter through its link without an account. Only becoming an admin (creating a splitter) needs it.

- The app uses the ecosystem's shared [Clerk](https://clerk.com) application `yolo-ecosystem` (production instance on `dantepham.site`), so one session works across every `*.dantepham.site` app.
- The frontend wraps the app in `ClerkProvider`, shows a "Sign in" button (Clerk's modal) or the user menu, and the Apollo client sends the session token as `Authorization: Bearer <token>` when signed in.
- The backend verifies the token with `@clerk/backend` (`backend/src/auth.ts`) and puts the Clerk user id in the GraphQL context as `clerkId` (null when signed out or the token is invalid, so the request carries on anonymously). `requireClerkId(context)` throws `UNAUTHENTICATED` for actions that need an account. `{ me { clerkId email name avatar } }` returns the signed-in user or null.
- **There is no User table.** The Clerk user id is the identity: `Splitter.adminUserId` is the creator's Clerk user id and `Member.userId` is set to the member's Clerk user id when a signed-in user links their member. Email, name and avatar are read from the ecosystem's shared `core.users` (`backend/src/coreUsers.ts`, read-only; only the core-users service in `ecosystem-infra` writes it), with the Clerk API as fallback when a new user's webhook has not arrived yet (DAN-93). Use `findUsers` to show a splitter's admin and linked members.
- `CLERK_AUTHORIZED_PARTIES` is only `https://bills.dantepham.site`, so session tokens issued to the other apps are refused.

## Deployment

Pushing to `main` deploys to production at **https://bills.dantepham.site** (`.github/workflows/deploy.yml`): it builds the backend and frontend images, pushes them to GHCR, copies `docker-compose.yml` to `/opt/bill-splitter` on the shared VPS and runs `doppler run -- docker compose up -d`. MongoDB is the ecosystem's shared instance (`ecosystem-mongo`, DAN-90): the backend logs in as the `bill-splitter` user with `MONGO_PASSWORD` from Doppler `bill-splitter/prd` (a reference to `shared/prd`). Pull requests run lint, typecheck and build (`.github/workflows/ci.yml`).

```
Browser ─HTTPS─▶ Cloudflare (proxied, SSL "Flexible") ─HTTP─▶ host nginx :80
  └─ bills.dantepham.site ─▶ 127.0.0.1:8083 (frontend nginx) ─▶ backend:4000 ─▶ ecosystem-mongo (shared)
```

Only the frontend publishes a port, bound to `127.0.0.1`. The backend and MongoDB are reachable only on the stack's internal Docker network.

### Secrets

All secrets live in Doppler project `bill-splitter`, config `prd`, so their values can be read again when needed. GitHub keeps only `DOPPLER_TOKEN`.

| Variable                                  | Value                                 | Used by                                                      |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `CLERK_SECRET_KEY`                        | `${shared.prd.CLERK_SECRET_KEY}`      | Backend, through `doppler run` on the VPS                    |
| `CLERK_PUBLISHABLE_KEY`                   | `${shared.prd.CLERK_PUBLISHABLE_KEY}` | Frontend build: CI passes it as `VITE_CLERK_PUBLISHABLE_KEY` |
| `CLERK_AUTHORIZED_PARTIES`                | `https://bills.dantepham.site`        | Backend                                                      |
| `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY` | `${shared.prd.VPS_HOST}` etc.         | Deploy job (SSH to the VPS); masked in the logs              |

There is no `VITE_` copy in Doppler, because Doppler does not allow a reference to a reference. After changing a secret, re-run the deploy workflow.

GitHub repository secret: `DOPPLER_TOKEN` only (read-only service token for `bill-splitter/prd`). GHCR pushes and the VPS pull use the job's own `GITHUB_TOKEN`, which expires when the job ends, so there is no personal access token.

### One-time server setup

1. `mkdir -p /opt/bill-splitter` as the deploy user.
2. Host nginx: `/etc/nginx/sites-available/bills.conf` with `server_name bills.dantepham.site;` and `proxy_pass http://127.0.0.1:8083;` (plus the usual `Host`, `X-Forwarded-For` and `X-Forwarded-Proto $http_x_forwarded_proto` headers), linked into `sites-enabled`, then `nginx -t && systemctl reload nginx`. Check first that port 8083 is free (`ss -ltn`).
3. Cloudflare: a proxied `A` record for `bills` pointing at the VPS.
4. Doppler: store a read-only service token for `bill-splitter/prd` for the deploy user, scoped to the app directory: `doppler configure set token --scope /opt/bill-splitter`.
5. Clerk: `bills` is already in the allowed subdomains of the shared app.

## Health check

`GET /health` returns `200` with `{"status":"ok","database":"connected"}`, or `503` with `"degraded"` while MongoDB is unreachable. The same data is available as the GraphQL query `{ health { status database time } }`.

## Scripts

| Command             | What it does                           |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Run backend and frontend in watch mode |
| `pnpm build`        | Build all packages                     |
| `pnpm lint`         | ESLint across the repo                 |
| `pnpm typecheck`    | TypeScript checks for all packages     |
| `pnpm format`       | Format with Prettier                   |
| `pnpm format:check` | Check formatting                       |
