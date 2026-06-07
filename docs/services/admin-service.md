# Admin Service (AdminJS)

**Port:** 3010 (par dÃ©faut)  
**RÃ´le:** interface dâ€™administration (CRUD rapide sur MySQL) et point dâ€™entrÃ©e sÃ©parÃ© de lâ€™API grand public.

## Ce que Ã§a fait concrÃ¨tement

- Sert lâ€™UI **AdminJS** sur `/admin` pour parcourir et modifier des tables partagÃ©es avec le reste de la plateforme (utilisateurs, vendeurs, commandes, sessions, Ã©vÃ©nements de sÃ©curitÃ©, IPs bloquÃ©es, etc.).
- Sâ€™authentifie contre le **user-service** via une route interne (`POST /internal/admin/authenticate`) avec le mÃªme **`INTERNAL_SHARED_SECRET`** que les autres appels machine-Ã -machine.

## Persistance

- **MySQL** â€” mÃªme base que user-service / order-service pour les entitÃ©s Â« relationnelles Â».
- Session admin Express (cookie) â€” voir variables dans le runbook.

## Variables dâ€™environnement (rÃ©sumÃ©)

| Variable | RÃ´le |
|----------|------|
| `INTERNAL_SHARED_SECRET` | Doit matcher le secret du user-service |
| `USER_SERVICE_URL` | Ex. `http://localhost:3001` |
| `PG_*` ou `DATABASE_URL` | Connexion MySQL |
| `ADMIN_SESSION_SECRET` | Signature des cookies de session (obligatoire en prod) |

## Hors programme (pour le mÃ©moire)

En cours on a surtout vu des API REST Â« plates Â». LÃ  on branche un **back-office graphique** (AdminJS) qui vit dans son propre service Node, avec session et accÃ¨s DB â€” utile pour les dÃ©mos sans Ã©crire un CRUD Angular complet.

## RÃ©fÃ©rences

- Runbook dÃ©taillÃ© : [ADMIN_RUNBOOK.md](../ADMIN_RUNBOOK.md)
- Code : `Amaz_back/admin-service/`

