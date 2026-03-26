# Microservices and storefront (users) mapping

**Narrative / mémoire (FR) :** see [`PLAN_MEMOIRE_DOCUMENTATION.md`](PLAN_MEMOIRE_DOCUMENTATION.md). **PDF bundle:** run `npm run docs:pdf` from `Amaz_back` → files in repo root [`docs/pdf/`](../../docs/pdf/).

Single entry from Angular: [`users/src/app/core/services/gateway-api.service.ts`](../../users/src/app/core/services/gateway-api.service.ts) (base URL + path). **Proof-of-Work** and auth headers are added by [`users/src/app/core/http/security-headers.interceptor.ts`](../../users/src/app/core/http/security-headers.interceptor.ts) for gateway calls.

Per-service deep dives: [`docs/services/README.md`](services/README.md).

## Service overview

| Service | Responsibility | Persistence | Key HTTP (behind gateway) | Primary frontend touchpoints |
|--------|----------------|-------------|---------------------------|------------------------------|
| **gateway** | PoW gate, routing, auth forward, `X-Request-Id` | — | `/api/v1/*` | All `HttpClient` calls to `environment.apiBaseUrl` |
| **user-service** | Register, login, JWT, profiles | PostgreSQL | `/auth/*`, `/users/*` (as proxied) | `AuthService`, login/register routes, `UserSessionStore` |
| **product-service** | Catalog CRUD, listings, wishlists | MongoDB `products`, wishlist collections | `/produits`, `/produits/suggest`, `/produits/:id`, `/wishlists/*` | `ProductsService`, `ProductCatalogStore`, PLP/PDP, `WishlistStore`, top-bar suggest |
| **order-service** | Orders lifecycle, stock coordination | PostgreSQL | `/commandes/*` | `OrdersService`, `OrdersStateStore`, checkout, order history |
| **messaging-service** | Vendor/customer threads | MongoDB | `/messages/*` | Messaging UI (vendor chat surfaces) |
| **ai-service** | Demo recommendations, bot auth stub | MongoDB (logs + product read for recs) | `/ai/recommendations`, `/bot/auth` | `AiService`; home recommendations via `OrdersStateStore` (merged with catalog) |
| **pepper-service** | Pepper-related demo API (if enabled) | Varies | Pepper routes as configured | Any lab or admin tools calling those paths |
| **admin-service** | AdminJS CRUD / ops UI | PostgreSQL | Not on gateway port 3000; direct `http://localhost:3010/admin` (dev) | Operators; see `docs/ADMIN_RUNBOOK.md` |

## Sequence: search submit to PLP

```mermaid
sequenceDiagram
  participant User
  participant Angular as Angular_users
  participant Interceptor as PoW_interceptor
  participant Gateway
  participant ProductSvc as product_service

  User->>Angular: Submit search form (top bar)
  Angular->>Angular: Router navigate to /produits?q=...
  Note over Angular: PLP reads query params; optional ProductCatalogStore already loaded
  User->>Angular: Type in search box (suggestions)
  Angular->>Interceptor: GET /produits/suggest?q=
  Interceptor->>Gateway: PoW headers + request
  Gateway->>ProductSvc: Forward GET /produits/suggest
  ProductSvc-->>Gateway: JSON items (title, image, price, ...)
  Gateway-->>Angular: 200 + body
  Angular->>User: Dropdown rows with image and price
  User->>Angular: Submit or open PLP
  Angular->>Interceptor: GET /produits?limit=... (catalog load)
  Interceptor->>Gateway: PoW headers + request
  Gateway->>ProductSvc: Forward GET /produits
  ProductSvc-->>Gateway: items + pagination
  Gateway-->>Angular: Catalog in ProductCatalogStore
  Angular->>User: PLP grid + client filters (category, price, q)
```

## Catalog seed and scale

- Mongo seed: `npm run db:mongo:init` (from `Amaz_back`) — legacy mock products plus generated rows (`db/mongo/init.js`).
- Storefront loads up to **500** products per `GET /produits` (see product-service limit cap and `ProductCatalogStore`).
