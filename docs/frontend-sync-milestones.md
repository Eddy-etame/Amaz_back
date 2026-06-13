# Jalons de synchronisation Frontend

## Jalon 1 — Auth + Vérification + Mot de passe oublié

- Gateway : `http://localhost:3000/api/v1`
- Endpoints :
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `POST /auth/verification/start`
  - `POST /auth/verification/confirm`
  - `POST /auth/password/forgot/start`
  - `POST /auth/password/forgot/confirm`
  - `POST /auth/password/reset`
- Exigences côté front :
  - Envoyer `Authorization: Bearer <accessToken>` après connexion.
  - Envoyer `X-Client-Fingerprint` + en-têtes PoW à chaque requête API.
  - Permettre le choix du canal (`email` ou `sms`) pour les endpoints de démarrage OTP.

## Jalon 2 — Intégration Commandes / Retours

- Endpoints commandes :
  - `POST /commandes`
  - `GET /commandes`
  - `GET /commandes/:orderId`
  - `PUT /commandes/:orderId/annuler`
  - `PUT /commandes/:orderId/statut`
- Compatibilité du payload :
  - Accepte `articles` ou `items`
  - Supporte les clés d'articles en français et en anglais (`produitId`/`productId`, `quantite`/`quantity`)

## Jalon 3 — Messagerie temps réel + repli REST

- REST :
  - `GET /messages/conversations`
  - `GET /messages/:produitId`
  - `POST /messages`
- Socket.IO :
  - URL : `http://localhost:3004/messages`
  - Payload d'authentification :
    - App acheteur : `{ userId, role: 'user' }`
    - App vendeur : `{ userId, role: 'vendor' }`
- Règle appliquée côté serveur :
  - Acheteur-vendeur uniquement (pas de canal acheteur-acheteur).

## Configuration backend requise avant les tests d'intégration

- `INTERNAL_SHARED_SECRET` défini et cohérent entre la gateway et les services.
- `ACCESS_HMAC_SECRET`, `REFRESH_HMAC_SECRET`, `PEPPER_MASTER_SECRET` non vides.
- Migration PostgreSQL exécutée.
- Bootstrap Mongo exécuté.
- `POW_DIFFICULTY` synchronisé avec les environnements front (`users` et `vendors`).
