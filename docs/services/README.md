# Amaz Backend Services Documentation

This directory contains per-service documentation for the Amaz microservices backend.

## Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| [Gateway](gateway.md) | 3000 | API entrypoint, PoW, rate limit, auth, proxy |
| [User Service](user-service.md) | 3001 | Auth, users, addresses, notifications |
| [Product Service](product-service.md) | 3002 | Products, stock, reserve/release |
| [Order Service](order-service.md) | 3003 | Orders, checkout |
| [Messaging Service](messaging-service.md) | 3004 | User-vendor messaging, Socket.IO |
| [AI Service](ai-service.md) | 3005 | AI recommendations, bot auth |
| [Pepper Service](pepper-service.md) | 3006 | Password/token peppering (HMAC) |
| [Admin Service](admin-service.md) | 3010 | AdminJS back-office (PostgreSQL) |

## Generating PDFs

Run from `Amaz_back`:

```bash
npm run docs:pdf
```

Output: **`docs/pdf/*.pdf`** at the **repository root** (sibling of `Amaz_back/`). See [`docs/pdf/README.md`](../../../docs/pdf/README.md).
