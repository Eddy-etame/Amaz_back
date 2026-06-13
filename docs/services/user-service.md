# Service Utilisateur (User Service)

**Port :** 3001  
**Rôle :** Authentification, gestion des utilisateurs, adresses, vérification (OTP), réinitialisation de mot de passe et notifications par email.

## Dépendances

- PostgreSQL (users, user_credentials, sessions, otp_requests, security_events, user_addresses)
- Pepper service (pour le hachage des mots de passe)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| USER_SERVICE_PORT | Non | 3001 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| ACCESS_HMAC_SECRET | Oui | - | HMAC pour les tokens d'accès |
| REFRESH_HMAC_SECRET | Oui | - | HMAC pour les tokens de rafraîchissement |
| PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | Oui | - | Connexion PostgreSQL |
| PEPPER_SERVICE_URL | Non | http://localhost:3006 | URL du pepper-service |
| PEPPER_CLIENT_SECRET | Non | - | Repli dev quand le pepper-service est indisponible |
| SESSION_TTL_MINUTES | Non | 60 | Durée de vie du token d'accès |
| REFRESH_TTL_DAYS | Non | 7 | Durée de vie du token de rafraîchissement |
| OTP_TTL_MINUTES | Non | 5 | Validité du code OTP |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| POST | /login | Connexion |
| POST | /register, /signup | Inscription |
| POST | /refresh | Rafraîchir le token |
| POST | /logout | Déconnexion |
| GET | /me | Profil de l'utilisateur courant |
| PUT | /me | Mise à jour du profil |
| GET | /addresses | Lister les adresses |
| POST | /addresses | Ajouter une adresse |
| PUT | /addresses/:id | Modifier une adresse |
| POST | /verification/start | Démarrer le flux OTP |
| POST | /verification/confirm | Confirmer l'OTP |
| POST | /password/forgot/start | Démarrer la réinitialisation du mot de passe |
| POST | /password/forgot/confirm | Confirmer l'OTP de réinitialisation |
| POST | /password/reset | Réinitialiser le mot de passe |
| POST | /internal/auth/introspect | Introspection de token (gateway) |
| POST | /internal/notifications/email | Envoi d'email (order-service) |

## Appelants internes autorisés

- gateway
- order-service

## Modèle de données (PostgreSQL)

- **users**, **vendors** (hérite de users)
- **user_credentials** (password_hash, password_salt)
- **sessions**, **token_revocations**
- **otp_requests**, **otp_attempts**, **password_reset_requests**
- **user_addresses**
- **security_events**
