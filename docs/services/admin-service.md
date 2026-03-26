# Admin Service (AdminJS)

**Port:** 3010 (par défaut)  
**Rôle:** interface d’administration (CRUD rapide sur PostgreSQL) et point d’entrée séparé de l’API grand public.

## Ce que ça fait concrètement

- Sert l’UI **AdminJS** sur `/admin` pour parcourir et modifier des tables partagées avec le reste de la plateforme (utilisateurs, vendeurs, commandes, sessions, événements de sécurité, IPs bloquées, etc.).
- S’authentifie contre le **user-service** via une route interne (`POST /internal/admin/authenticate`) avec le même **`INTERNAL_SHARED_SECRET`** que les autres appels machine-à-machine.

## Persistance

- **PostgreSQL** — même base que user-service / order-service pour les entités « relationnelles ».
- Session admin Express (cookie) — voir variables dans le runbook.

## Variables d’environnement (résumé)

| Variable | Rôle |
|----------|------|
| `INTERNAL_SHARED_SECRET` | Doit matcher le secret du user-service |
| `USER_SERVICE_URL` | Ex. `http://localhost:3001` |
| `PG_*` ou `DATABASE_URL` | Connexion Postgres |
| `ADMIN_SESSION_SECRET` | Signature des cookies de session (obligatoire en prod) |

## Hors programme (pour le mémoire)

En cours on a surtout vu des API REST « plates ». Là on branche un **back-office graphique** (AdminJS) qui vit dans son propre service Node, avec session et accès DB — utile pour les démos sans écrire un CRUD Angular complet.

## Références

- Runbook détaillé : [ADMIN_RUNBOOK.md](../ADMIN_RUNBOOK.md)
- Code : `Amaz_back/admin-service/`
