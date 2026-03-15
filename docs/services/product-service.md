# Product Service

**Port:** 3002  
**Purpose:** Product catalog, stock management, and stock reserve/release for orders.

## Dependencies

- MongoDB (products collection)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PRODUCT_SERVICE_PORT | No | 3002 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| MONGO_URI, MONGO_DB_NAME | Yes | - | MongoDB connection |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /produits | List products (paginated, filterable) |
| GET | /produits/:id | Get product by ID |
| POST | /produits | Create product (vendor role) |
| PUT | /produits/:id | Update product (vendor role) |
| DELETE | /produits/:id | Delete product (vendor role) |
| POST | /internal/produits/:id/reserve | Reserve stock (order-service only) |
| POST | /internal/produits/:id/release | Release stock (order-service only) |

## Allowed Internal Callers

- gateway
- order-service

## Data Model (MongoDB)

- **products**: id, title, description, price, category, city, stock, vendorId, status, sku, image, gallery, rating, reviewCount, createdAt, updatedAt
