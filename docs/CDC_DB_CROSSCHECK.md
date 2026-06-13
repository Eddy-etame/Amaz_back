# Croisement CDC ↔ base de données Amaz

> Dernière mise à jour : 2026-04-07 (alignée sur les migrations PostgreSQL 001→009 et l'init Mongo).

## Objectif

Comparer le **modèle de données prévu** (notre cahier des charges interne : [`docs/modelisation-entites.md`](../../docs/modelisation-entites.md) et [`docs/justification-db.md`](../../docs/justification-db.md)) avec l'**implémentation réelle** (migrations PostgreSQL + initialisation MongoDB).

> Le document Word d'origine (« Entite et modelisation de la DB.docx ») est conservé hors dépôt. Tant qu'il n'est pas exporté en texte, c'est notre `modelisation-entites.md` qui sert de référence de croisement (il reprend les mêmes entités).

## 1. Entités du modèle → implémentation

| Entité (modèle) | Base prévue | Implémentation réelle | Statut | Note |
|-----------------|-------------|-----------------------|--------|------|
| utilisateur | SQL | `users` + `user_credentials` | ÉCART | Le hash/sel sont sortis dans `user_credentials` (séparation des secrets), pas dans la même table. |
| role / utilisateur_role | SQL | colonne `role` + table `vendors` (héritage) + vue `user_accounts` | ÉCART | Pas de table `role` normalisée ; le rôle est porté par le compte (user/vendor) au lieu d'une jointure n-n. |
| adresse | SQL | `user_addresses` (003) | OK | Nommage anglais. |
| commande | SQL | `orders` (001) + `order_status_history` (007) | OK | Historique de statut ajouté en plus du modèle. |
| ligne_commande | SQL | `order_items` (001) | OK | Snapshot titre/prix conforme au modèle. |
| token_session | SQL | `sessions` + `token_revocations` (001) | OK | Révocation persistée dans une table dédiée. |
| produit | NoSQL | collection `products` (Mongo) | OK | Conforme (titre, prix, stock, images, tags). |
| categorie | NoSQL | champ `categorie` sur le produit | PARTIEL | Catégorie portée par le produit ; pas (encore) de collection `categories` hiérarchique avec `parent_id_ref`. |
| avis | NoSQL | — | ABSENT | Les avis/notes ne sont pas implémentés (priorité donnée à commandes/messagerie/retours). |
| favori | NoSQL | collection `wishlists` (product-service) | OK | Nommé « wishlist » (favoris côté front), avec `shareToken` en plus. |
| message | NoSQL | collection(s) messaging-service | OK | Restreint acheteur ↔ vendeur. |
| log_ai | NoSQL | logs/recos ai-service | PARTIEL | Recommandations de démo ; journalisation minimale. |
| conv_bot | NoSQL | `bot/auth` (ai-service) | PARTIEL | Évaluation de risque d'auth ; pas de stockage conversationnel complet. |

**Légende :** `OK` = couvert · `PARTIEL` = champs/règles manquants · `ABSENT` = pas en base · `ÉCART` = nommage/structure différents (documenté).

## 2. Ajouts par rapport au modèle initial (évolution du projet)

Ces tables/collections n'étaient pas dans le MCD de départ ; elles sont apparues avec les besoins de sécurité et de cycle de vie. Elles illustrent l'évolution réelle du schéma.

| Ajout | Base | Migration / source | Pourquoi |
|-------|------|--------------------|----------|
| `otp_requests`, `otp_attempts` | SQL | 001 | Vérification OTP (email/SMS) et anti-bruteforce. |
| `password_reset_requests` | SQL | 001 | Réinitialisation de mot de passe avec expiration. |
| `security_events` | SQL | 001 | Piste d'audit (login, approbation vendeur, blocage IP…). |
| `payment_attempts` | SQL | 001 | Tentatives de paiement liées aux commandes. |
| `vendors` (+ approbation) | SQL | 002, 005, 008 | Comptes vendeurs et validation par un admin avant publication. |
| `blocked_ips` | SQL | 006 | Blocage d'IP appliqué par la gateway (cache TTL court). |
| `returns` | SQL | 009 | Flux de retours (returns-service) avec QR de retour. |

## 3. Règles

- Ne proposer des **migrations** que pour les lignes `PARTIEL`, `ABSENT` ou `ÉCART`, et seulement après validation produit.
- **Ne pas** supprimer de table ou de collection sans accord explicite sur le dépôt `amaz_`.
- Quand le `.docx` officiel sera disponible en texte, ajouter une colonne « attributs CDC » et rejouer ce croisement ligne à ligne.
