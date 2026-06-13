# Runbook d'administration

## Source de vérité (recommandé)

| Action | Chemin privilégié | Audit |
|--------|-------------------|-------|
| **Approuver / rejeter un vendeur** | Actions AdminJS **Approve vendor** / **Reject vendor** (appelle le user-service en interne) | Lignes dans `security_events` (`admin.vendor_approved` / `admin.vendor_rejected`) |
| **Approuver / rejeter un vendeur (API)** | Gateway : `PATCH /api/v1/auth/admin/vendors/:id/approve` ou `.../reject` avec un token admin (Bearer HMAC) | Même `security_events` |
| **Liste de blocage IP** | API admin de la gateway ou AdminJS sur `blocked_ips` | Privilégier l'API pour des `security_events` cohérents ; les modifications brutes via AdminJS peuvent omettre certaines métadonnées |
| **Commandes / order_items** | AdminJS en **lecture d'abord** ; éviter les modifications manuelles de statut qui contredisent les règles métier de l'order-service | Utiliser les procédures de support |

Routes internes (machine uniquement, signées `x-internal-*`) : `PATCH /internal/admin/vendors/:vendorId/approve` et `.../reject` avec le corps JSON `{ "actorEmail": "<email admin>" }`. L'appelant doit être **`admin-service`**. Utilisé par les actions AdminJS pour que l'email de l'admin connecté soit associé à l'audit.

## Durcissement sécurité (AdminJS)

- Session : définir un **`ADMIN_SESSION_SECRET`** fort dans tout environnement hors dev ; cookie **`secure: true`** quand le service est servi en HTTPS.
- **Ne pas** exposer le port **3010** sur l'internet public sans TLS et restrictions réseau (VPN, liste blanche, ou sous-réseau privé).
- La ressource **Sessions** dans AdminJS masque **access_token_hash** et **refresh_token_hash** de la liste/affichage/édition (les tokens restent en base ; l'UI ne montre pas les hashes).

## Deux surfaces d'administration

| Surface | URL / accès | Usage |
|---------|-------------|-------|
| **AdminJS** | `http://localhost:3010/admin` (par défaut) | CRUD rapide sur les tables **PostgreSQL** (users, vendors, orders, sessions, `security_events`, `blocked_ips`, etc.). Catalogue **MongoDB** en lecture seule optionnel quand `MONGO_URI` est défini. |
| **REST (user-service)** | Via gateway : `GET/POST/DELETE /api/v1/auth/admin/...` avec un token **admin** (Bearer HMAC) | Approbation/rejet vendeur, liste de blocage IP ; les réponses respectent les conventions API de l'application. |

**Source de vérité :** Privilégier les **actions AdminJS** ou l'**API admin de la gateway** pour l'approbation des vendeurs afin que `security_events` reste cohérent. Les modifications directes de `vendors.approval_status` dans AdminJS sont possibles mais **non recommandées** pour la gouvernance en production.

## Environnement (admin-service)

- `INTERNAL_SHARED_SECRET` — doit correspondre au user-service (appelant interne `admin-service`).
- `USER_SERVICE_URL` — ex. `http://localhost:3001` pour `/internal/admin/authenticate`.
- `PG_*` ou `DATABASE_URL` — même Postgres que la plateforme (la table de session `admin_session` est créée par `connect-pg-simple` si absente).
- `ADMIN_SESSION_SECRET` — chaîne aléatoire forte pour la signature de session Express (obligatoire en production).

## Durcissement (production)

- Lier AdminJS au **réseau interne** uniquement ou le placer derrière un VPN ; ne pas exposer le port `3010` sur l'internet public sans TLS + authentification.
- Faire tourner régulièrement `ADMIN_SESSION_SECRET` et les mots de passe admin.
- Envisager une **liste blanche IP** au niveau du load balancer pour `/admin`.
- Utiliser la **2FA** pour les comptes admin (non inclus ; à intégrer via un IdP ou un reverse proxy si nécessaire).

## Catalogue MongoDB dans AdminJS (optionnel)

Quand **`MONGO_URI`** (et éventuellement **`MONGO_DB_NAME`**) est défini dans `.env`, l'`admin-service` enregistre une ressource **en lecture seule** **Catalogue (Mongo, lecture seule)** sur la collection `products` (`@adminjs/mongoose` + schéma flexible). Les actions créer/modifier/supprimer sont désactivées. Les modifications opérationnelles du catalogue doivent passer par le **product-service** avec des logs d'audit en production.

## Blocage d'adresses IP

- **Application à l'exécution :** la gateway lit `blocked_ips` (Postgres) avec un cache à TTL court.
- **Gestion :** `POST/GET/DELETE /api/v1/auth/admin/ip-blocklist` (token admin HMAC) ou modifier `blocked_ips` dans AdminJS (s'assurer que le TTL du cache de la gateway permet un déblocage rapide).

## Références

- Admin de seed : `db/postgres/seed.js` (`admin@amaz.local` en dev).
- Route interne user-service : `POST /internal/admin/authenticate` (utilisée par la connexion AdminJS).
