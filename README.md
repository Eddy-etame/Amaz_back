# Amaz Backend

Microservices backend for the Amaz marketplace:

- `gateway` (API entrypoint + security middleware)
- `services/user-service`
- `services/product-service`
- `services/order-service`
- `services/messaging-service`
- `services/ai-service`
- `services/pepper-service`

## Which URL should I open?

| Goal | URL | Notes |
|------|-----|-------|
| **API calls (clients, Postman, frontend)** | `http://localhost:3000/api/v1/...` | Use the gateway. Requires PoW headers for `/api/v1/*` (users/vendors apps add these automatically). |
| **Gateway health** | `http://localhost:3000/health` | Public. |
| **Aggregate health (all services)** | `http://localhost:3000/health/aggregate` | Public. |
| **Admin panel (AdminJS)** | `http://localhost:3010/admin` | Separate service; see `docs/ADMIN_RUNBOOK.md`. |
| **Direct service liveness** | `http://localhost:3001/health` … `http://localhost:3006/health` | Public. Use for Docker/QA health checks. |
| **Service info (root)** | `http://localhost:3001/` … `http://localhost:3006/` | Public. Returns usage hints. |
| **Direct business routes** | `http://localhost:3002/produits`, etc. | **Do not use from browser.** Returns `INTERNAL_AUTH_REQUIRED` unless signed `x-internal-*` headers are present (gateway and internal callers only). |

## Services overview

| Service | Port | Purpose | Allowed direct callers |
|---------|------|---------|------------------------|
| gateway | 3000 | API entrypoint, PoW, rate limit, auth, proxy | Clients (with PoW) |
| user-service | 3001 | Auth, users, addresses, notifications | gateway, order-service |
| product-service | 3002 | Products, stock, reserve/release | gateway, order-service |
| order-service | 3003 | Orders, checkout | gateway |
| messaging-service | 3004 | User-vendor messaging, Socket.IO | gateway |
| ai-service | 3005 | AI recommendations, bot auth | gateway |
| pepper-service | 3006 | Password/token peppering (HMAC) | user-service |

## Constraints respected

- Node.js + Express only
- PostgreSQL + MongoDB native driver
- Manual security primitives (no JWT libs, no bcrypt, no passport)
- User-vendor messaging only

## Environment

Copy `.env.example` to `.env` and fill secrets.

**Bootstrap vs restart:** `npm run db:bootstrap` (and `db:seed`) are **manual, one-time** setup steps when you first clone the project or after you intentionally reset data. **Restarting Docker or Node does not wipe the database** and does not automatically re-seed. Demo seeds are for **development only** — they replace seed rows on `npm run db:postgres:seed` when you run the seed script, not on every DB restart.

Required for minimal runs:

- **Gateway:** `INTERNAL_SHARED_SECRET`
- **User service:** `INTERNAL_SHARED_SECRET`, `ACCESS_HMAC_SECRET`, `REFRESH_HMAC_SECRET`; optional for dev when Pepper is down: `PEPPER_CLIENT_SECRET`
- **Pepper service:** `INTERNAL_SHARED_SECRET`, `PEPPER_MASTER_SECRET`
- **PostgreSQL:** `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` (for user-service and order-service)
- **MongoDB:** `MONGO_URI`, `MONGO_DB_NAME` (for product, messaging, ai services)
- **Product-service** also reads **PostgreSQL** (`PG_*`) to enforce **vendor approval** on catalog mutations.
- **Admin-service:** `INTERNAL_SHARED_SECRET`, `USER_SERVICE_URL`, `PG_*` (or `DATABASE_URL`), optional `ADMIN_SESSION_SECRET` — see `docs/ADMIN_RUNBOOK.md`.

Leave `CORS_ALLOWED_ORIGINS` empty to allow all origins (e.g. QA lab on port 4202).

## Startup order

Start services in this order so dependencies are up:

1. **Databases:** `docker compose up -d` (Postgres + Mongo).
2. **Pepper** (port 3006) - no DB; other services may call it for hashing.
3. **User** (3001) - needs Postgres and Pepper (or `PEPPER_CLIENT_SECRET` in dev).
4. **Product** (3002), **Order** (3003), **Messaging** (3004), **AI** (3005) - order between them does not matter.
5. **Gateway** (3000) - last; it proxies to all of the above.

Health checks: use `GET http://localhost:3000/health/aggregate` to see gateway + all services status (e.g. from QA lab or `scripts/run-qa-campaign.js`).

**Full local verification** (stack + DB required): from `Amaz_back` run `npm run verify:local`. See [docs/VERIFY.md](docs/VERIFY.md) for prerequisites, skip flags, and Angular build commands.

**API contract (draft):** [docs/openapi/gateway-v1.yaml](docs/openapi/gateway-v1.yaml)

## Quick start

**Important:** Run `npm run db:bootstrap` before first use. Without it, the products collection is empty and order confirmation will fail with 400.

From `Amaz_back`:

```bash
# 1. Start databases
docker compose up -d

# 2. Bootstrap DB (migrations + seed)
npm run db:bootstrap

# 3. Start full stack (use docker-compose.full.yml)
docker compose -f docker-compose.full.yml up -d --build
```

Seeded users (see `db/postgres/seed.js`): **`test@amaz.com` / `AmazQA2026!`** (QA lab default; override with `SEED_QA_TEST_PASSWORD`), and `eddy.etame@enkoschools.com` / `Amaz@2026!`.

## Local DB orchestration (Docker)

Run these commands from `Amaz_back`:

- Start PostgreSQL + MongoDB: `docker compose up -d`
- Check containers state: `docker compose ps`
- Check health logs if needed: `docker compose logs postgres mongo`
- Stop containers: `docker compose down`
- Stop and remove named volumes: `docker compose down -v`

## Database bootstrap

**One command (recommended on the host):**

```bash
npm run db:bootstrap
```

Runs all Postgres migrations in `db/postgres/migrations`, then Postgres seed and Mongo init.

**Docker full stack:** `npm run db:bootstrap` uses `PG_HOST` from `.env` (often `localhost:5432`). That must be the **same** Postgres instance the containers use (port published from `amaz-postgres`). If you have another PostgreSQL on `5432`, bootstrap may update the wrong database and the app will still error (e.g. PostgreSQL `42703`). In that case run migrations **inside** Compose:

```bash
npm run db:bootstrap:docker
```

(requires stack up: `docker compose -f docker-compose.full.yml up -d`; uses the `bootstrap` service under `--profile tools`.)

**Manual steps:**

- PostgreSQL: run all files in `db/postgres/migrations/` in lexical order (or use `npm run db:bootstrap`)
- Postgres seed: `npm run db:postgres:seed`
- Mongo init: `npm run db:mongo:init`

## Testing

**Prerequisites:** Docker (Postgres + Mongo), or full stack running.

| Command | Description |
|---------|-------------|
| `npm test` | Smoke tests (static file/snippet checks, no services needed) |
| `npm run qa:campaign` | Direct `/health` on each service with **retries** (env: `QA_HEALTH_RETRIES`, `QA_HEALTH_RETRY_MS`; requires stack on localhost) |
| `npm run test:contract-smoke` | Port health + GET `/api/v1/produits` + POST `/api/v1/bot/auth` with PoW (`SKIP_CONTRACT=1` = skip PoW calls) |
| `npm run test:gateway-suite` | **Full API regression** via gateway: PoW + register/login/me + products + orders + AI + messages + bot/auth (run on the **host** where Docker publishes `3000–3006`). Waits up to 60s for user-service in aggregate (override with `GATEWAY_SUITE_WAIT_USER_MS`, or `GATEWAY_SUITE_SKIP_WAIT=1` to disable) |
| `npm run test:e2e-auth` | E2E auth: login + GET /auth/me with PoW (gateway, user-service, pepper, Postgres) |

**QA Lab (browser):** `cd qa-lab && npm install && ng serve` (port **4202**). Use **Run all** to mirror `test:gateway-suite`. Gateway CORS includes `http://localhost:4202` in `docker-compose.full.yml` by default.

**Postman:** `postman/amaz-backend-e2e.postman_collection.json` (requires PoW variables).

**Docs:** Markdown under `docs/` (services, apps, plan mémoire, manuel). **PDFs:** from `Amaz_back` run `npm run docs:pdf` → output **`../docs/pdf/*.pdf`** (repo root).

## Documentation

- **Admin & security:** [docs/ADMIN_RUNBOOK.md](docs/ADMIN_RUNBOOK.md)
- **UX / marketplace backlog:** [docs/UX_BACKLOG.md](docs/UX_BACKLOG.md)
- **Entités DB (CDC vs implémentation) :** [docs/CDC_ENTITES_DB.md](docs/CDC_ENTITES_DB.md), [docs/CDC_DB_CROSSCHECK.md](docs/CDC_DB_CROSSCHECK.md)

## QA pack

- Smoke checks: `npm test`
- Postman collection: `postman/amaz-backend-e2e.postman_collection.json`
- Security review checklist: `docs/security-risk-review.md`

## Notes

- Proof-of-work and rate limiting are enforced through shared middleware.
- Token/session handling uses opaque signed tokens with DB-backed revocation.
- Socket.IO server runs on messaging service (`MESSAGING_SERVICE_PORT`, namespace `/messages`).
