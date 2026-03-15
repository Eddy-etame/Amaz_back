# AI Service

**Port:** 3005  
**Purpose:** AI-powered product recommendations and bot auth/risk scoring.

## Dependencies

- MongoDB (products, ai_logs collections)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| AI_SERVICE_PORT | No | 3005 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| MONGO_URI, MONGO_DB_NAME | Yes | - | MongoDB connection |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /ai/recommendations | Get product recommendations by query |
| POST | /bot/auth | Bot auth risk score (state, action) |

## Allowed Internal Callers

- gateway

## Data Model (MongoDB)

- **products**: Read for recommendations
- **ai_logs**: Logs recommendation and bot-auth requests
