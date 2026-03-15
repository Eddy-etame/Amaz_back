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
| /api/v1/produits, /api/v1/products | product-service | GET public; POST/PUT/DELETE yes |
| /api/v1/commandes, /api/v1/orders | order-service | Yes |
| /api/v1/messages | messaging-service | Yes |
| /api/v1/ai, /api/v1/bot | ai-service | Yes |

## Allowed Callers

Clients (with valid PoW headers and optional Bearer token for protected routes).
