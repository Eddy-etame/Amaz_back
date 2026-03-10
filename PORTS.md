# Amaz Backend - Port Reference

## Microservices

| Service | Port | Description |
|---------|------|-------------|
| **Gateway** | 3000 | API gateway (main entry point for clients) |
| **User Service** | 3001 | Auth, users, sessions, OTP |
| **Product Service** | 3002 | Product catalog (MongoDB) |
| **Order Service** | 3003 | Orders, order items (PostgreSQL) |
| **Messaging Service** | 3004 | Chat, WebSocket (MongoDB) |
| **AI Service** | 3005 | AI features (MongoDB) |
| **Pepper Service** | 3006 | Pepper layer 1 (internal) |
| **pepper-primary** | 3007 | Pepper layer 2 (internal); both used in hash: salt+pepper-primary+pepper-service |

## Databases

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL** | 5432 | Users, sessions, orders |
| **MongoDB** | 27017 | Products, messaging, AI |

## Frontend (reference)

| App | Port | Description |
|-----|------|-------------|
| **Users** | 4200 | Marketplace (Angular) |
| **Vendors** | 4201 | Seller dashboard (Angular) |
| **Admin** | 4202 | Admin panel (Angular) |

## Environment Variables (port overrides)

Each service port can be overridden via environment variables:

- `GATEWAY_PORT` (default: 3000)
- `USER_SERVICE_PORT` (default: 3001)
- `PRODUCT_SERVICE_PORT` (default: 3002)
- `ORDER_SERVICE_PORT` (default: 3003)
- `MESSAGING_SERVICE_PORT` (default: 3004)
- `AI_SERVICE_PORT` (default: 3005)
- `PEPPER_SERVICE_PORT` (default: 3006)
- `PEPPER_PRIMARY_URL` (default: http://localhost:3007)
- `PG_PORT` (default: 5432)
