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

Copy `.env.example` to `.env` and fill secrets. Required for minimal runs:

- **Gateway:** `INTERNAL_SHARED_SECRET`
- **User service:** `INTERNAL_SHARED_SECRET`, `ACCESS_HMAC_SECRET`, `REFRESH_HMAC_SECRET`; optional for dev when Pepper is down: `PEPPER_CLIENT_SECRET`
- **Pepper service:** `INTERNAL_SHARED_SECRET`, `PEPPER_MASTER_SECRET`
- **PostgreSQL:** `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` (for user-service and order-service)
- **MongoDB:** `MONGO_URI`, `MONGO_DB_NAME` (for product, messaging, ai services)

Leave `CORS_ALLOWED_ORIGINS` empty to allow all origins (e.g. QA lab on port 4202).

## Startup order

Start services in this order so dependencies are up:

1. **Databases:** `docker compose up -d` (Postgres + Mongo).
2. **Pepper** (port 3006) - no DB; other services may call it for hashing.
3. **User** (3001) - needs Postgres and Pepper (or `PEPPER_CLIENT_SECRET` in dev).
4. **Product** (3002), **Order** (3003), **Messaging** (3004), **AI** (3005) - order between them does not matter.
5. **Gateway** (3000) - last; it proxies to all of the above.

Health checks: use `GET http://localhost:3000/health/aggregate` to see gateway + all services status (e.g. from QA lab or `scripts/run-qa-campaign.js`).

## Quick start

From `Amaz_back`:

```bash
# 1. Start databases
docker compose up -d

# 2. Bootstrap DB (migrations + seed)
npm run db:bootstrap

# 3. Start full stack (use docker-compose.full.yml)
docker compose -f docker-compose.full.yml up -d --build
```

Seeded users: `eddy.etame@enkoschools.com` / `Amaz@2026!` (see `db/postgres/seed.js`).

## Local DB orchestration (Docker)

Run these commands from `Amaz_back`:

- Start PostgreSQL + MongoDB: `docker compose up -d`
- Check containers state: `docker compose ps`
- Check health logs if needed: `docker compose logs postgres mongo`
- Stop containers: `docker compose down`
- Stop and remove named volumes: `docker compose down -v`

## Database bootstrap

**One command (recommended):**

```bash
npm run db:bootstrap
```

Runs all Postgres migrations (001–004) and seed, then Mongo init.

**Manual steps:**

- PostgreSQL: run migrations in order: `001_init.sql`, `002_vendors.sql`, `003_user_addresses.sql`, `004_user_accounts_view_fix.sql`
- Postgres seed: `npm run db:postgres:seed`
- Mongo init: `npm run db:mongo:init`

## Testing

**Prerequisites:** Docker (Postgres + Mongo), or full stack running.

| Command | Description |
|---------|-------------|
| `npm test` | Smoke tests (static file/snippet checks, no services needed) |
| `npm run qa:campaign` | Health checks on all services (requires stack running) |
| `npm run test:e2e-auth` | E2E auth: login + GET /auth/me with PoW (requires gateway, user-service, pepper, Postgres) |

**Postman:** `postman/amaz-backend-e2e.postman_collection.json` (requires PoW variables).

**Docs:** Per-service Markdown in `docs/services/`. Generate PDFs: `npm run docs:pdf` (output: `docs/output/*.pdf`).

## QA pack

- Smoke checks: `npm test`
- Postman collection: `postman/amaz-backend-e2e.postman_collection.json`
- Security review checklist: `docs/security-risk-review.md`

## Notes

- Proof-of-work and rate limiting are enforced through shared middleware.
- Token/session handling uses opaque signed tokens with DB-backed revocation.
- Socket.IO server runs on messaging service (`MESSAGING_SERVICE_PORT`, namespace `/messages`).
