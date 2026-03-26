# Application « vendors » (espace vendeur)

Angular dans le dossier `vendors/`. Elle sert aux acteurs qui vendent sur la marketplace : suivre leurs ventes, le catalogue qui les concerne, et échanger avec les clients quand la messagerie est branchée.

## Point d’entrée API

Comme pour l’app users, les appels HTTP partent vers la **gateway** (même mécanisme PoW + auth). En pratique on réutilise le même genre d’intercepteurs et de service de base URL que sur le storefront, adaptés aux routes vendeur (statuts de commandes, threads de messages, etc.).

## Logique métier (vue projet)

- Les vendeurs sont des utilisateurs avec un **rôle** particulier ; certaines actions passent par des endpoints admin ou internes pour l’approbation (PostgreSQL côté user-service / admin).
- Le **product-service** vérifie qu’un vendeur est « approuvé » avant certaines mutations sur le catalogue (middleware côté API — ça évite qu’un compte fraîchement créé publie n’importe quoi sans validation).

## Pour le rapport

On peut dire qu’on a séparé **deux frontends Angular** pour coller au métier : un parcours acheteur et un parcours vendeur, au lieu d’un seul gros monolithe avec des dizaines de `*ngIf` sur le rôle.

## Voir aussi

- `vendors/DOCUMENTATION.md`
- Fiches microservices : [product-service.md](../services/product-service.md), [order-service.md](../services/order-service.md), [messaging-service.md](../services/messaging-service.md)
