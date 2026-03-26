# Local verification (Amaz_back)

## Prerequisites

1. **PostgreSQL + MongoDB** running (`docker compose up -d` from `Amaz_back`).
2. **Migrations + seed**: `npm run db:bootstrap` (uses `PG_*` from `.env` — must match services).
3. **Full API stack** on localhost ports **3000–3006** (e.g. `docker compose -f docker-compose.full.yml up -d --build`).
4. **`.env`** in `Amaz_back` with secrets documented in [README.md](../README.md).

## One-shot backend check

From `Amaz_back`:

```bash
npm run verify:local
```

This runs in order:

1. `npm test` — static structure / wiring smoke (no network).
2. `npm run test:contract-smoke` — per-service health + minimal PoW contract via gateway.
3. `npm run qa:campaign` — `/health` on gateway and each service port.
4. `npm run test:gateway-suite` — PoW + register/login + produits + commandes + wishlist + AI + messages + bot auth.
5. `npm run test:e2e-auth` — login + `/auth/me` with seeded-style credentials.

**Failures:** If step 2+ fail with connection errors, the stack is not up or ports are wrong. If auth fails with `42703`, run `npm run db:bootstrap` against the same database the user-service uses.

## Skip steps (CI or partial runs)

| Variable | Effect |
|----------|--------|
| `VERIFY_SKIP_SMOKE=1` | Skip static `npm test` |
| `VERIFY_SKIP_CONTRACT=1` | Skip contract smoke |
| `VERIFY_SKIP_HEALTH=1` | Skip QA health campaign |
| `VERIFY_SKIP_GATEWAY=1` | Skip gateway API suite |
| `VERIFY_SKIP_E2E_AUTH=1` | Skip e2e auth |
| `VERIFY_NETWORK_ONLY=1` | Only network steps (skip static smoke) |

Example: static smoke only (no Docker):

```bash
VERIFY_SKIP_CONTRACT=1 VERIFY_SKIP_HEALTH=1 VERIFY_SKIP_GATEWAY=1 VERIFY_SKIP_E2E_AUTH=1 npm run verify:local
```

## Frontend builds (separate)

Angular apps are not run by `verify:local`. After backend is green (from repo root, adjust paths if your layout differs):

```bash
cd users && npx ng build
cd ../vendors && npx ng build
cd ../qa-lab && npx ng build
```

From `Amaz_back` you can use `cd ../users && npx ng build` if `users` sits next to `Amaz_back`.

**Unit tests (users):**

- `cd users && npx ng test` — Karma/Jasmine (may open a browser unless configured headless).
- `cd users && npm run test:unit` — Vitest for pure utils / `ShareService.absoluteUrl` (headless).

## PWA (users storefront)

The `users` app ships a **Web App Manifest** only (`manifest.webmanifest`): installable shortcut name, theme colors, `start_url`. There is **no service worker** and **no caching of API responses** by design (avoids stale cart, stock, and prices during demos). Adding a SW later would require an explicit cache strategy documented here.

## PoW

All gateway calls from `users` continue to use the existing **Proof-of-Work** headers via `securityHeadersInterceptor`; verification scripts (`test:gateway-suite`, `test:contract-smoke`) exercise that contract.

## Catalog, PLP filters, and search suggestions (manual)

After Mongo is up:

1. **Reseed catalog** (from `Amaz_back`): `npm run db:mongo:init`  
   - Expect **more than 400** products total (legacy + generated).

2. **API smoke** (with gateway + PoW as in `test:gateway-suite`, or authenticated as your env requires):  
   - `GET /api/v1/produits?limit=500` — `data.pagination.total` should be **> 400** after reseed.  
   - `GET /api/v1/produits/suggest?q=bu&limit=8` — non-empty `data.items` when the catalog matches; each item should include image and price fields.

3. **users storefront** (`cd ../users && npx ng serve` or your usual command):  
   - **PLP:** Set prix min (e.g. 100), click **Appliquer** — no product below min; URL contains `minPrix` (and `maxPrix` if set). Refresh keeps filters.  
   - **Search bar:** Type at least 2 characters — dropdown shows **thumbnail + title + price** (server suggest when online; falls back to in-memory catalog if the request fails).

See also [MICROSERVICES_FRONTEND_MAP.md](./MICROSERVICES_FRONTEND_MAP.md) for how services map to Angular.
