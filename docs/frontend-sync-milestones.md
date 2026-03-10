# Frontend Sync Milestones

## Milestone 1 - Auth + Verification + Forgot Password

- Gateway: `http://localhost:3000/api/v1`
- Endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `POST /auth/verification/start`
  - `POST /auth/verification/confirm`
  - `POST /auth/password/forgot/start`
  - `POST /auth/password/forgot/confirm`
  - `POST /auth/password/reset`
- Front requirements:
  - Send `Authorization: Bearer <accessToken>` after login.
  - Send `X-Client-Fingerprint` + PoW headers on each API request.
  - Allow user channel choice (`email` or `sms`) for OTP start endpoints.

## Milestone 2 - Orders / Returns integration

- Orders endpoints:
  - `POST /commandes`
  - `GET /commandes`
  - `GET /commandes/:orderId`
  - `PUT /commandes/:orderId/annuler`
  - `PUT /commandes/:orderId/statut`
- Payload compatibility:
  - Accepts `articles` or `items`
  - Supports french and english item keys (`produitId`/`productId`, `quantite`/`quantity`)

## Milestone 3 - Messaging realtime + REST fallback

- REST:
  - `GET /messages/conversations`
  - `GET /messages/:produitId`
  - `POST /messages`
- Socket.IO:
  - URL: `http://localhost:3004/messages`
  - auth payload:
    - user app: `{ userId, role: 'user' }`
    - vendor app: `{ userId, role: 'vendor' }`
- Rule enforced server-side:
  - user-vendor only (no user-user channel).

## Required backend config before integration tests

- `INTERNAL_SHARED_SECRET` set and consistent across gateway/services.
- `ACCESS_HMAC_SECRET`, `REFRESH_HMAC_SECRET`, `PEPPER_MASTER_SECRET` non-empty.
- PostgreSQL migration executed.
- Mongo bootstrap executed.
- `POW_DIFFICULTY` synchronized with front environments (`users` and `vendors`).
