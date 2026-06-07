# Application Â« vendors Â» (espace vendeur)

Angular dans le dossier `vendors/`. Elle sert aux acteurs qui vendent sur la marketplace : suivre leurs ventes, le catalogue qui les concerne, et Ã©changer avec les clients quand la messagerie est branchÃ©e.

## Point dâ€™entrÃ©e API

Comme pour lâ€™app users, les appels HTTP partent vers la **gateway** (mÃªme mÃ©canisme PoW + auth). En pratique on rÃ©utilise le mÃªme genre dâ€™intercepteurs et de service de base URL que sur le storefront, adaptÃ©s aux routes vendeur (statuts de commandes, threads de messages, etc.).

## Logique mÃ©tier (vue projet)

- Les vendeurs sont des utilisateurs avec un **rÃ´le** particulier ; certaines actions passent par des endpoints admin ou internes pour lâ€™approbation (MySQL cÃ´tÃ© user-service / admin).
- Le **product-service** vÃ©rifie quâ€™un vendeur est Â« approuvÃ© Â» avant certaines mutations sur le catalogue (middleware cÃ´tÃ© API â€” Ã§a Ã©vite quâ€™un compte fraÃ®chement crÃ©Ã© publie nâ€™importe quoi sans validation).

## Pour le rapport

On peut dire quâ€™on a sÃ©parÃ© **deux frontends Angular** pour coller au mÃ©tier : un parcours acheteur et un parcours vendeur, au lieu dâ€™un seul gros monolithe avec des dizaines de `*ngIf` sur le rÃ´le.

## Voir aussi

- `vendors/DOCUMENTATION.md`
- Fiches microservices : [product-service.md](../services/product-service.md), [order-service.md](../services/order-service.md), [messaging-service.md](../services/messaging-service.md)

