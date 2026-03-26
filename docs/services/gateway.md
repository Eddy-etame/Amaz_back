# Gateway Service

**Port:** 3000  
**Purpose:** API entrypoint for all client requests. Enforces proof-of-work (PoW), rate limiting, and authentication before proxying to downstream services.

## Dependencies

- None (no database). Proxies to all other services.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| GATEWAY_PORT | No | 3000 | HTTP port |
| GATEWAY_HOST | No | 0.0.0.0 | Bind address |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for signing internal requests |
| INTERNAL_TRUST_MODE | No | `shared_secret` | **Développement :** `shared_secret` (défaut) — le proxy signe avec `INTERNAL_SHARED_SECRET`. **Cible production (contrat v1.2) :** `mtls` — confiance mutuelle TLS entre Gateway et microservices ; les en-têtes `X-User-Id` / `X-User-Role` (ou équivalents `x-auth-user-id` / `x-auth-role` côté proxy actuel) complètent l’identité après terminaison mTLS. La valeur `mtls` est **documentaire** pour l’instant : l’implémentation reste `shared_secret` tant que l’infra réseau (Proxmox/VLAN/certificats) n’est pas branchée. |
| POW_DIFFICULTY | No | 3 | Leading zeros required in PoW hash |
| POW_WINDOW_MS | No | 120000 | PoW validity window (ms) |
| RATE_LIMIT_WINDOW_MS | No | 60000 | Rate limit window (ms) |
| RATE_LIMIT_MAX | No | 120 | Max requests per window |
| CORS_ALLOWED_ORIGINS | No | (all) | Comma-separated allowed origins |
| USERS_SERVICE_URL | No | http://localhost:3001 | User service URL |
| PRODUCTS_SERVICE_URL | No | http://localhost:3002 | Product service URL |
| ORDERS_SERVICE_URL | No | http://localhost:3003 | Order service URL |
| MESSAGING_SERVICE_URL | No | http://localhost:3004 | Messaging service URL |
| AI_SERVICE_URL | No | http://localhost:3005 | AI service URL |
| PEPPER_SERVICE_URL | No | http://localhost:3006 | Pepper service URL |

## Public Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Gateway liveness |
| GET | /health/aggregate | Gateway + all services status |

## API Routes (require PoW headers)

| Path | Proxies To | Auth Required |
|------|------------|---------------|
| /api/v1/auth/* | user-service | Public paths: login, register, signup, verification, password reset, refresh |
| /api/v1/addresses | user-service | Yes |
| /api/v1/produits, /api/v1/products | product-service | **GET :** PoW + **auth optionnelle** (Bearer → en-têtes `x-auth-*` vers le service). **Mutation :** Bearer obligatoire. |
| /api/v1/commandes, /api/v1/orders | order-service | Yes |
| /api/v1/messages | messaging-service | Yes |
| /api/v1/ai/* | ai-service | Yes (Bearer) |
| /api/v1/bot/* | ai-service | **POST /api/v1/bot/auth :** PoW uniquement (contrat v1.2). Autres routes bot : Bearer requis. |

### Erreurs PoW (contrat v1.2)

Toutes les réponses d’échec de preuve de travail côté gateway utilisent le **HTTP 403** et le message générique **« Preuve invalide »** (code métier `POW_*` conservé dans le corps JSON pour le diagnostic, sans fuite d’information sur la cause exacte).

### Appels internes Gateway → microservices

- **Aujourd’hui :** requêtes HTTP signées (`x-internal-signature`, etc.) avec `INTERNAL_SHARED_SECRET`.
- **Cible documentée :** mTLS entre nœuds + propagation d’identité ; variable `INTERNAL_TRUST_MODE=mtls` décrit l’intention ; pas de suppression du mode `shared_secret` sans validation ops.

## Allowed Callers

Clients (with valid PoW headers and optional Bearer token for protected routes).
