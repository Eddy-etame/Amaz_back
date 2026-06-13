# Documentation des services backend Amaz

Ce répertoire contient la documentation par service pour le backend microservices Amaz.

## Vue d'ensemble des services

| Service | Port | Rôle |
|---------|------|------|
| [Gateway](gateway.md) | 3000 | Point d'entrée API, PoW, rate limit, authentification, proxy |
| [User Service](user-service.md) | 3001 | Authentification, utilisateurs, adresses, notifications |
| [Product Service](product-service.md) | 3002 | Produits, stock, réservation/libération |
| [Order Service](order-service.md) | 3003 | Commandes, checkout |
| [Messaging Service](messaging-service.md) | 3004 | Messagerie acheteur-vendeur, Socket.IO |
| [Returns Service](returns-service.md) | 3008 | Flux de retours avec portée vendeur/acheteur |
| [AI Service](ai-service.md) | 3005 | Recommandations IA, authentification bot |
| [Pepper Service](pepper-service.md) | 3006 | Peppering de mots de passe/tokens (HMAC) |
| [Admin Service](admin-service.md) | 3010 | Back-office AdminJS (PostgreSQL) |

## Génération des PDFs

Depuis `Amaz_back` :

```bash
npm run docs:pdf
```

Sortie : **`docs/pdf/*.pdf`** à la **racine du dépôt** (au même niveau que `Amaz_back/`). Voir [`docs/pdf/README.md`](../../../docs/pdf/README.md).
