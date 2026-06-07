# Croisement CDC â†” base de donnÃ©es Amaz

## Objectif

Comparer le **cahier des charges** (entitÃ©s et modÃ©lisation DB, document Word utilisateur) avec lâ€™**implÃ©mentation** actuelle (migrations MySQL + initialisation MongoDB).

## Ã‰tat actuel

| EntitÃ© / concept (mÃ©tier) | ImplÃ©mentation | Fichier(s) de rÃ©fÃ©rence |
|---------------------------|----------------|-------------------------|
| Utilisateur | `users` | `migrations/001_init.sql` |
| Vendeur | `vendors` + vue `user_accounts` | `002_vendors.sql`, `004_user_accounts_view_fix.sql` |
| Identifiants | `user_credentials` | `001_init.sql` |
| Session / tokens | `sessions`, `token_revocations` | `001_init.sql` |
| OTP / reset | `otp_*`, `password_reset_requests` | `001_init.sql` |
| Audit sÃ©curitÃ© | `security_events` | `001_init.sql` |
| Commande | `orders`, `order_items` | `001_init.sql` |
| Historique statut commande | `order_status_history` | `007_order_status_history.sql` |
| Paiement (tentatives) | `payment_attempts` | `001_init.sql` |
| Adresses utilisateur | `user_addresses` | `003_user_addresses.sql` |
| Approbation vendeur | colonnes dÃ©diÃ©es (vendor) | `005_vendor_approval.sql` |
| IP bloquÃ©es | `blocked_ips` | `006_blocked_ips.sql` |
| Produits (catalogue) | Collection Mongo | `db/mongo/init.js`, product-service |
| Liste de souhaits | Collection Mongo `wishlists` | product-service |
| Messagerie | Collection(s) Mongo | messaging-service |
| Logs AI / bot | Collection(s) Mongo | ai-service |

## Tableau CDC officiel (Ã  remplir)

Une fois le contenu de `Entite et modelisation de la DB.docx` exportÃ© en texte, ajouter ici les lignes du CDC :

| EntitÃ© (CDC) | Attributs clÃ©s (CDC) | Cible Amaz | Statut |
|--------------|----------------------|------------|--------|
| *(Ã  complÃ©ter)* | | | |

**LÃ©gende statut :** `OK` = couvert tel quel Â· `PARTIEL` = champs ou rÃ¨gles manquants Â· `ABSENT` = pas encore en base Â· `Ã‰CART` = nommage ou type diffÃ©rent (documenter).

## RÃ¨gles

- Proposer des **migrations** ou scripts uniquement pour les lignes en `PARTIEL`, `ABSENT` ou `Ã‰CART` **aprÃ¨s** validation produit / utilisateur.
- **Ne pas** supprimer de tables ou collections sans accord explicite sur le dÃ©pÃ´t `amaz_`.

