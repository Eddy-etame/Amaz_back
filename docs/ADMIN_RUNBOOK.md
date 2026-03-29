# Admin operations runbook

## Source of truth (recommended)

| Action | Preferred path | Audit |
|--------|----------------|--------|
| **Approve / reject vendor** | AdminJS record actions **Approve vendor** / **Reject vendor** (calls user-service internally) | Rows in `security_events` (`admin.vendor_approved` / `admin.vendor_rejected`) |
| **Approve / reject vendor (API)** | Gateway: `PATCH /api/v1/auth/admin/vendors/:id/approve` or `.../reject` with admin JWT | Same `security_events` |
| **IP blocklist** | Gateway admin API or AdminJS on `blocked_ips` | Prefer API for consistent `security_events`; raw AdminJS edits may skip some metadata |
| **Order / order_items** | AdminJS **read-first**; avoid manual status edits that contradict `order-service` business rules | Use support playbooks |

Internal routes (machine-only, signed `x-internal-*`): `PATCH /internal/admin/vendors/:vendorId/approve` and `.../reject` with JSON body `{ "actorEmail": "<admin email>" }`. Caller must be **`admin-service`**. Used by AdminJS actions so the logged-in admin email is tied to audit.

## Security hardening (AdminJS)

- Session: set a strong **`ADMIN_SESSION_SECRET`** in every non-dev environment; cookie **`secure: true`** when served over HTTPS.
- **Do not** expose port **3010** on the public internet without TLS and network restrictions (VPN, allowlist, or private subnet).
- **Sessions** resource in AdminJS hides **access_token_hash** and **refresh_token_hash** from list/show/edit (tokens remain in DB; UI does not surface hashes).

## Two admin surfaces

| Surface | URL / access | Use for |
|--------|----------------|---------|
| **AdminJS** | `http://localhost:3010/admin` (default) | Fast CRUD on **PostgreSQL** tables (users, vendors, orders, sessions, `security_events`, `blocked_ips`, …). Optional **read-only** MongoDB `products` when `MONGO_URI` is set. |
| **REST (user-service)** | Via gateway: `GET/POST/DELETE /api/v1/auth/admin/...` with **admin** JWT | Vendor approve/reject, IP blocklist; responses align with app API conventions. |
| **Angular `admin` app** | Separate SPA (repo `Rep_Amazon-Admin`) | Landing page with links to AdminJS, gateway health, and this runbook—not a second CRUD source of truth. |

**Source of truth:** Prefer **AdminJS actions** or **gateway admin API** for vendor approval so `security_events` stays consistent. Raw edits to `vendors.approval_status` in AdminJS are possible but **not recommended** for production governance.

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

## MongoDB catalog in AdminJS (optional)

When **`MONGO_URI`** (and optionally **`MONGO_DB_NAME`**) is set in `.env`, `admin-service` registers a **read-only** resource **Catalog (Mongo, read-only)** on the `products` collection (`@adminjs/mongoose` + flexible schema). Create/edit/delete actions are disabled. Operational catalog changes should still go through **product-service** with audit logs in production.

## Blocking IPs

- **Runtime enforcement:** gateway reads `blocked_ips` (Postgres) with a short TTL cache.
- **Management:** `POST/GET/DELETE /api/v1/auth/admin/ip-blocklist` (admin JWT) or edit `blocked_ips` in AdminJS (ensure gateway cache TTL allows timely unblock).

## References

- Seed admin: `db/postgres/seed.js` (`admin@amaz.local` in dev).
- User-service internal: `POST /internal/admin/authenticate` (used by AdminJS login).
