# Manuel utilisateur — Amaz (version projet / démo)

Ce manuel décrit comment utiliser la plateforme **telle qu’on l’a livrée pour le projet annuel**. Ce n’est pas un guide commercial : certaines étapes supposent que les serveurs tournent en local ou sur un environnement de démo fourni par l’équipe.

## Avant de commencer

- Le **backend** (gateway + microservices + bases) doit être démarré ; sinon les pages restent vides ou affichent des erreurs réseau.
- L’URL de l’API dans l’app Angular doit pointer vers la **gateway** (port 3000 en développement), pas vers les ports internes des services.

## Créer un compte et se connecter

1. Ouvrir l’application **users** dans le navigateur (URL fournie par l’équipe, souvent `http://localhost:4200` en dev).
2. Aller sur **Inscription** si tu n’as pas encore de compte, remplir le formulaire et valider.
3. Si le projet impose une **vérification e-mail** en démo, suis les indications affichées à l’écran (en environnement de cours, l’e-mail peut être simulé ou désactivé — demander à l’équipe).
4. Te **connecter** avec ton identifiant et ton mot de passe.

## Parcourir le catalogue

1. La page liste des produits affiche une grille ou une liste selon ce qu’on a implémenté.
2. Tu peux utiliser la **recherche** ou les **filtres** (catégorie, prix, etc.) ; certains filtres mettent à jour l’URL pour que tu puisses copier-coller le lien.
3. Cliquer sur un produit ouvre la **fiche détail** (prix, description, vendeur affiché quand les données seed le permettent).

## Liste de souhaits (wishlist)

Si la fonctionnalité est activée dans la démo : connecte-toi, puis ajoute des articles à ta liste depuis la fiche produit ou la liste. Les routes passent par la gateway comme le reste.

## Panier et commande

1. Ajoute des produits au **panier**.
2. Ouvre le panier, vérifie les quantités.
3. Passe à la **commande** (checkout) : l’app envoie une création de commande au **order-service** via la gateway ; le paiement réel n’existe pas dans notre périmètre scolaire — c’est une **simulation** (statuts, confirmation à l’écran).

## Suivre ses commandes

Dans la zone **Mes commandes** (libellé exact selon l’UI), tu vois l’historique et le statut. Si un service est arrêté, tu peux recevoir une erreur « service indisponible ».

## Messagerie avec un vendeur

Quand la messagerie est branchée : depuis le contexte d’une commande ou d’un produit, ouvre la conversation. Les messages passent par le **messaging-service** ; en temps réel, l’interface peut utiliser **Socket.IO** (comportement plus « chat » qu’un simple refresh de page).

## Application vendeur

Les personnes avec un compte **vendeur** (après approbation admin selon le scénario) utilisent l’app **vendors** : gestion des offres visibles, suivi des commandes les concernant, réponses aux messages clients.

## Messages d’erreur fréquents

| Symptôme | Explication rapide |
|----------|-------------------|
| Erreur 401 | Session expirée ou token invalide — se reconnecter. |
| Erreur 403 / preuve de travail | En appel manuel (Postman) sans les en-têtes PoW ; les apps Angular les ajoutent normalement toutes seules. |
| Erreur 503 | Un microservice est considéré comme down par la gateway — vérifier que tous les processus tournent. |
| Prix bizarres sur vieux produits seed | Données de démo mélangées (anciens montants en centimes) ; le front ou le seed a des garde-fous, mais en démo il peut rester des cas limites. |

## Besoin d’aide technique

Voir le README du dépôt et le fichier **VERIFY** pour les commandes de vérification locale ; pour l’architecture, le **plan mémoire** dans `Amaz_back/docs/PLAN_MEMOIRE_DOCUMENTATION.md`.
