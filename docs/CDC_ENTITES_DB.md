# EntitÃ©s et modÃ©lisation â€” alignement projet Amaz

## Document source (cahier des charges)

Le cahier des charges fourni par lâ€™Ã©quipe est le fichier Word :

`C:\Users\Mommy Jayce\Downloads\Entite et modelisation de la DB.docx`

Ce format nâ€™est pas exploitable directement dans le dÃ©pÃ´t. **Pour une revue ligne Ã  ligne avec le CDC officiel** :

1. Exporter le document en **Markdown** ou **texte** (ou copier les sections Â« entitÃ©s Â», Â« relations Â», Â« contraintes Â»).
2. Les placer sous `Amaz_back/docs/` (ex. `CDC_OFFICIEL.md`) ou les coller dans une issue / message de suivi.

## ModÃ¨le implÃ©mentÃ© aujourdâ€™hui (rÃ©fÃ©rence code)

SynthÃ¨se des **entitÃ©s mÃ©tier** couvertes par le backend actuel, indÃ©pendamment du Word.

### MySQL (`db/MySQL/migrations`)

| Domaine | Tables / vues | RÃ´le |
|--------|----------------|------|
| Comptes | `users`, `vendors` (hÃ©ritage), vue `user_accounts` | Utilisateurs et vendeurs |
| Auth | `user_credentials`, `sessions`, `token_revocations` | Hash mot de passe, sessions HMAC, rÃ©vocations |
| SÃ©curitÃ© | `otp_requests`, `otp_attempts`, `password_reset_requests`, `security_events` | OTP, reset, audit |
| Commandes | `orders`, `order_items`, `payment_attempts` | Panier validÃ©, lignes, paiement |
| Adresses | `user_addresses` (migration 003) | Adresses de livraison |
| Vendeurs | colonnes dâ€™approbation (migration 005) | Catalogue rÃ©servÃ© aux vendeurs approuvÃ©s |
| RÃ©seau | `blocked_ips` (migration 006) | Blocage IP cÃ´tÃ© infra |

### MongoDB (`db/mongo/init.js` et services)

Collections typiques (noms exacts dans `init.js` / services) :

| Domaine | Usage |
|--------|--------|
| Produits | Catalogue, stock, galerie (product-service) |
| Listes de souhaits | Collection `wishlists` (product-service / Mongo) : `ownerUserId`, `items`, `shareToken`, `shareDisabledAt` optionnel |
| Messagerie | Conversations utilisateur â†” vendeur (messaging-service) |
| AI | Logs / recommandations (ai-service) |

## Relations logiques (implÃ©mentation)

- **User** 1â€”N **Orders** ; **Order** 1â€”N **Order_items** (rÃ©fÃ©rence `product_id` cÃ´tÃ© Mongo pour le dÃ©tail produit).
- **Vendor** liÃ© aux produits Mongo via `vendorId` ; statut dâ€™approbation en **MySQL**.
- **Sessions** liÃ©es Ã  **users** par `user_id`.

## Prochaine Ã©tape (croisement CDC)

Quand le texte du `.docx` sera disponible en clair, complÃ©ter le tableau dans [`CDC_DB_CROSSCHECK.md`](CDC_DB_CROSSCHECK.md) : une ligne par entitÃ© CDC â†’ table/collection â†’ statut (OK / Ã©cart / Ã  migrer). **Aucune migration destructive sans validation Ã©crite.**

