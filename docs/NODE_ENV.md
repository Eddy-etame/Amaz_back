# NODE_ENV: Development vs Production

## What NODE_ENV Does

`NODE_ENV` is a standard Node.js environment variable that indicates the runtime mode. It affects logging, error details, caching, and **security checks** in this project.

## Development vs Production

| Aspect | `development` | `production` |
|--------|---------------|---------------|
| **Placeholder secrets** | Allowed (e.g. `change-pepper-master-secret`) | **Rejected** – app throws and exits |
| **Error messages** | More verbose (stack traces, internal codes) | Sanitized (e.g. "unreachable" instead of ECONNREFUSED) |
| **Logging** | Debug-level, more output | Typically info/warn only |
| **Performance** | May skip optimizations | Caching, minification, etc. |

## Why Use Development in Docker (with Default Secrets)

When running `docker compose -f docker-compose.full.yml up` **without** setting real secrets in `.env`, the services use placeholder values like:

- `INTERNAL_SHARED_SECRET=change-this-internal-secret`
- `PEPPER_MASTER_SECRET=change-pepper-master-secret`
- `ACCESS_HMAC_SECRET=change-access-hmac-secret`

The `requiredSecret()` helper in each service checks:

```javascript
if (process.env.NODE_ENV === 'production' && value.startsWith('change-')) {
  throw new Error(`Secret ${name} still uses placeholder value`);
}
```

So:

- **`NODE_ENV=production`** + placeholder → app **crashes on startup**
- **`NODE_ENV=development`** + placeholder → app **starts** (for local/dev use only)

## When to Use Production

Use `NODE_ENV=production` when:

1. You have **real secrets** (not starting with `change-`)
2. You are deploying to a real environment (staging, production)
3. You want stricter security and less verbose errors

## Summary

| Scenario | NODE_ENV | Secrets |
|----------|----------|---------|
| Local dev, Docker with defaults | `development` | Placeholders OK |
| Production deployment | `production` | Real secrets required |
