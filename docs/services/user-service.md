# User Service

**Port:** 3001  
**Purpose:** Authentication, user management, addresses, verification (OTP), password reset, and email notifications.

## Dependencies

- PostgreSQL (users, user_credentials, sessions, otp_requests, security_events, user_addresses)
- Pepper service (for password hashing)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| USER_SERVICE_PORT | No | 3001 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| ACCESS_HMAC_SECRET | Yes | - | HMAC for access tokens |
| REFRESH_HMAC_SECRET | Yes | - | HMAC for refresh tokens |
| PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | Yes | - | PostgreSQL connection |
| PEPPER_SERVICE_URL | No | http://localhost:3006 | Pepper service URL |
| PEPPER_CLIENT_SECRET | No | - | Dev fallback when Pepper is down |
| SESSION_TTL_MINUTES | No | 60 | Access token TTL |
| REFRESH_TTL_DAYS | No | 7 | Refresh token TTL |
| OTP_TTL_MINUTES | No | 5 | OTP code validity |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /login | Login |
| POST | /register, /signup | Registration |
| POST | /refresh | Refresh token |
| POST | /logout | Logout |
| GET | /me | Current user profile |
| PUT | /me | Update profile |
| GET | /addresses | List addresses |
| POST | /addresses | Add address |
| PUT | /addresses/:id | Edit address |
| POST | /verification/start | Start OTP flow |
| POST | /verification/confirm | Confirm OTP |
| POST | /password/forgot/start | Start password reset |
| POST | /password/forgot/confirm | Confirm reset OTP |
| POST | /password/reset | Reset password |
| POST | /internal/auth/introspect | Token introspection (gateway) |
| POST | /internal/notifications/email | Send email (order-service) |

## Allowed Internal Callers

- gateway
- order-service

## Data Model (PostgreSQL)

- users, vendors (inherits users)
- user_credentials (password_hash, password_salt)
- sessions, token_revocations
- otp_requests, otp_attempts, password_reset_requests
- user_addresses
- security_events
