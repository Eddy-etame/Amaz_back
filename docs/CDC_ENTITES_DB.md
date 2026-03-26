# Entités et modélisation — alignement projet Amaz

## Document source (cahier des charges)

Le cahier des charges fourni par l’équipe est le fichier Word :

`C:\Users\Mommy Jayce\Downloads\Entite et modelisation de la DB.docx`

Ce format n’est pas exploitable directement dans le dépôt. **Pour une revue ligne à ligne avec le CDC officiel** :

1. Exporter le document en **Markdown** ou **texte** (ou copier les sections « entités », « relations », « contraintes »).
2. Les placer sous `Amaz_back/docs/` (ex. `CDC_OFFICIEL.md`) ou les coller dans une issue / message de suivi.

## Modèle implémenté aujourd’hui (référence code)

Synthèse des **entités métier** couvertes par le backend actuel, indépendamment du Word.

### PostgreSQL (`db/postgres/migrations`)

| Domaine | Tables / vues | Rôle |
|--------|----------------|------|
| Comptes | `users`, `vendors` (héritage), vue `user_accounts` | Utilisateurs et vendeurs |
| Auth | `user_credentials`, `sessions`, `token_revocations` | Hash mot de passe, sessions HMAC, révocations |
| Sécurité | `otp_requests`, `otp_attempts`, `password_reset_requests`, `security_events` | OTP, reset, audit |
| Commandes | `orders`, `order_items`, `payment_attempts` | Panier validé, lignes, paiement |
| Adresses | `user_addresses` (migration 003) | Adresses de livraison |
| Vendeurs | colonnes d’approbation (migration 005) | Catalogue réservé aux vendeurs approuvés |
| Réseau | `blocked_ips` (migration 006) | Blocage IP côté infra |

### MongoDB (`db/mongo/init.js` et services)

Collections typiques (noms exacts dans `init.js` / services) :

| Domaine | Usage |
|--------|--------|
| Produits | Catalogue, stock, galerie (product-service) |
| Listes de souhaits | Collection `wishlists` (product-service / Mongo) : `ownerUserId`, `items`, `shareToken`, `shareDisabledAt` optionnel |
| Messagerie | Conversations utilisateur ↔ vendeur (messaging-service) |
| AI | Logs / recommandations (ai-service) |

## Relations logiques (implémentation)

- **User** 1—N **Orders** ; **Order** 1—N **Order_items** (référence `product_id` côté Mongo pour le détail produit).
- **Vendor** lié aux produits Mongo via `vendorId` ; statut d’approbation en **PostgreSQL**.
- **Sessions** liées à **users** par `user_id`.

## Prochaine étape (croisement CDC)

Quand le texte du `.docx` sera disponible en clair, compléter le tableau dans [`CDC_DB_CROSSCHECK.md`](CDC_DB_CROSSCHECK.md) : une ligne par entité CDC → table/collection → statut (OK / écart / à migrer). **Aucune migration destructive sans validation écrite.**
