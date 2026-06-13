# Service Pepper (Pepper Service)

**Port :** 3006  
**Rôle :** Peppering basé sur HMAC pour les mots de passe et les tokens. Utilisé par le user-service pour le hachage sécurisé des mots de passe.

## Dépendances

- Aucune (pas de base de données)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| PEPPER_SERVICE_PORT | Non | 3006 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| PEPPER_MASTER_SECRET | Oui | - | Secret maître pour le peppering HMAC |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| POST | /internal/pepper/hash | Hacher une valeur avec un contexte (password, token, otp) |

## Appelants internes autorisés

- user-service

## Contextes

Contextes autorisés pour le HMAC : `password`, `token`, `otp`.
