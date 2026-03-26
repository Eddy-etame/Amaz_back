# Croisement CDC ↔ base de données Amaz

## Objectif

Comparer le **cahier des charges** (entités et modélisation DB, document Word utilisateur) avec l’**implémentation** actuelle (migrations PostgreSQL + initialisation MongoDB).

## État actuel

| Entité / concept (métier) | Implémentation | Fichier(s) de référence |
|---------------------------|----------------|-------------------------|
| Utilisateur | `users` | `migrations/001_init.sql` |
| Vendeur | `vendors` + vue `user_accounts` | `002_vendors.sql`, `004_user_accounts_view_fix.sql` |
| Identifiants | `user_credentials` | `001_init.sql` |
| Session / tokens | `sessions`, `token_revocations` | `001_init.sql` |
| OTP / reset | `otp_*`, `password_reset_requests` | `001_init.sql` |
| Audit sécurité | `security_events` | `001_init.sql` |
| Commande | `orders`, `order_items` | `001_init.sql` |
| Historique statut commande | `order_status_history` | `007_order_status_history.sql` |
| Paiement (tentatives) | `payment_attempts` | `001_init.sql` |
| Adresses utilisateur | `user_addresses` | `003_user_addresses.sql` |
| Approbation vendeur | colonnes dédiées (vendor) | `005_vendor_approval.sql` |
| IP bloquées | `blocked_ips` | `006_blocked_ips.sql` |
| Produits (catalogue) | Collection Mongo | `db/mongo/init.js`, product-service |
| Liste de souhaits | Collection Mongo `wishlists` | product-service |
| Messagerie | Collection(s) Mongo | messaging-service |
| Logs AI / bot | Collection(s) Mongo | ai-service |

## Tableau CDC officiel (à remplir)

Une fois le contenu de `Entite et modelisation de la DB.docx` exporté en texte, ajouter ici les lignes du CDC :

| Entité (CDC) | Attributs clés (CDC) | Cible Amaz | Statut |
|--------------|----------------------|------------|--------|
| *(à compléter)* | | | |

**Légende statut :** `OK` = couvert tel quel · `PARTIEL` = champs ou règles manquants · `ABSENT` = pas encore en base · `ÉCART` = nommage ou type différent (documenter).

## Règles

- Proposer des **migrations** ou scripts uniquement pour les lignes en `PARTIEL`, `ABSENT` ou `ÉCART` **après** validation produit / utilisateur.
- **Ne pas** supprimer de tables ou collections sans accord explicite sur le dépôt `amaz_`.
