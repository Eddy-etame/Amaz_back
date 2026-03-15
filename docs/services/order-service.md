# Order Service

**Port:** 3003  
**Purpose:** Order creation, status management, and checkout flow. Reserves product stock and notifies users.

## Dependencies

- PostgreSQL (orders, order_items, payment_attempts)
- Product service (stock reserve/release)
- User service (user lookup, email notifications)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ORDER_SERVICE_PORT | No | 3003 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| PRODUCTS_SERVICE_URL | No | http://localhost:3002 | Product service URL |
| USERS_SERVICE_URL | No | http://localhost:3001 | User service URL |
| PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | Yes | - | PostgreSQL connection |
| INTERNAL_FETCH_TIMEOUT_MS | No | 7000 | Timeout for internal HTTP calls |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /commandes | Create order |
| GET | /commandes | List orders (user) |
| GET | /commandes/:id | Get order by ID |
| PUT | /commandes/:id/annuler | Cancel order |
| PUT | /commandes/:id/statut | Update order status |

## Allowed Internal Callers

- gateway

## Data Model (PostgreSQL)

- **orders**: id, user_id, status, total_amount, currency, estimated_delivery_at, delivered_at, shipping_address, payment_status, payment_method
- **order_items**: id, order_id, product_id, product_title, unit_price, quantity, vendor_id
- **payment_attempts**: id, order_id, provider, amount, currency, status
