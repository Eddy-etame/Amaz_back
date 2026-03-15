# Pepper Service

**Port:** 3006  
**Purpose:** HMAC-based peppering for passwords and tokens. Used by user-service for secure password hashing.

## Dependencies

- None (no database)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PEPPER_SERVICE_PORT | No | 3006 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| PEPPER_MASTER_SECRET | Yes | - | Master secret for HMAC peppering |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /internal/pepper/hash | Hash value with context (password, token, otp) |

## Allowed Internal Callers

- user-service

## Contexts

Allowed contexts for HMAC: `password`, `token`, `otp`.
