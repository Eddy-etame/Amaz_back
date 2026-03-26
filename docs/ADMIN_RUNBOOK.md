# Admin operations runbook

## Two admin surfaces

| Surface | URL / access | Use for |
|--------|----------------|---------|
| **AdminJS** | `http://localhost:3010/admin` (default) | Fast CRUD on **PostgreSQL** tables (users, vendors, orders, sessions, `security_events`, `blocked_ips`, …). |
| **REST (user-service)** | Via gateway: `GET/POST/DELETE /api/v1/auth/admin/...` with **admin** JWT | Vendor approve/reject, IP blocklist; responses align with app API conventions. |

**Source of truth:** Agree as a team whether vendor lifecycle changes go through **REST** (audited in `security_events`) only, or also allow raw edits in AdminJS. Approvals logged via API include metadata; raw SQL/UI edits may not.

## Environment (admin-service)

- `INTERNAL_SHARED_SECRET` — must match user-service (internal caller `admin-service`).
- `USER_SERVICE_URL` — e.g. `http://localhost:3001` for `/internal/admin/authenticate`.
- `PG_*` or `DATABASE_URL` — same Postgres as the platform (sessions table `admin_session` is created by `connect-pg-simple` if missing).
- `ADMIN_SESSION_SECRET` — strong random string for Express session signing (set in production).

## Hardening (production)

- Bind AdminJS to **internal network** only or put behind VPN; do not expose `3010` on the public internet without TLS + auth.
- Rotate `ADMIN_SESSION_SECRET` and admin passwords periodically.
- Consider an **IP allowlist** at the load balancer for `/admin`.
- Use **2FA** for admin accounts (not bundled; integrate via IdP or reverse proxy if required).

## Optional: MongoDB products in AdminJS

The catalog lives in **MongoDB** (`products` collection). AdminJS can use `@adminjs/mongoose` with a Mongoose schema, or a custom resource:

1. Add dependency in `admin-service`: `@adminjs/mongoose`, `mongoose`.
2. Connect with `MONGO_URI` / `MONGO_DB_NAME` from `.env`.
3. Define a **read-only** schema first (`isVisible: { edit: false }` on resources) to avoid accidental catalog wipes.
4. Prefer **operational** edits (stock, status) via **product-service** APIs with audit logs long-term.

## Blocking IPs

- **Runtime enforcement:** gateway reads `blocked_ips` (Postgres) with a short TTL cache.
- **Management:** `POST/GET/DELETE /api/v1/auth/admin/ip-blocklist` (admin JWT) or edit `blocked_ips` in AdminJS (ensure gateway cache TTL allows timely unblock).

## References

- Seed admin: `db/postgres/seed.js` (`admin@amaz.local` in dev).
- User-service internal: `POST /internal/admin/authenticate` (used by AdminJS login).
