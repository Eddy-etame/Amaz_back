# Journal de bord — projet Amaz (février → avril 2026)

Ce journal retrace l'évolution réelle du projet, phase par phase. Les dates et les
auteurs correspondent à l'historique Git des dépôts (`users`, `vendors`, `qa-lab`,
`Amaz_back`). On y note ce qui a été fait, par qui, et les difficultés rencontrées.
Le travail ne s'est pas fait d'un bloc : il y a des périodes denses et des pauses
(révisions, autres cours), visibles dans les écarts de dates ci-dessous.

## Phase 1 — Vitrine acheteur, premiers écrans (9 → 16 février)

- **9 fév.** — Initialisation du dépôt `users`. Simone crée le composant de connexion et la structure de départ ; Eddy ajoute les composants panier, checkout, accueil, commandes, profil.
- **10 fév.** — Simone met en place tous les composants et configure le routing.
- **11–12 fév.** — Intégration des **images** (catalogue + galerie) par Simone ; Eddy ajoute les styles, les **données mock** pour tester, puis un mode de paiement et des commandes « façon Amazon ».
- **16 fév.** — Première version complète du front acheteur avec données fictives et simulation.
- *À ce stade, pas encore de backend : on avance l'UX avec des stores locaux et des mocks.*

> Pause (révisions / autres modules) entre la mi-février et début mars.

## Phase 2 — Espace vendeur (3 → 9 mars)

- **3 mars** — Brad initialise le front `vendors` (espace vendeur).
- **9 mars** — Refonte du style et création du système de **messagerie** (mock) ; ajout des liens entre vendeur et acheteur côté `users`.

## Phase 3 — Backend microservices et sécurité (10 → 15 mars)

- **10 mars** — Démarrage du dépôt `Amaz_back` : gateway, **Dockerfiles par microservice**, moniteur de santé qui vérifie tous les services, ajout du **pepper-service**.
- **11 mars** — Fusion de l'**auth** et de la **gateway**, initialisation de la base de données.
- **13 mars** — Brad ajoute le **rate limiter**, le **blocage VPN/IP**, les **favoris**, les **notifications** et la **logique de paiement**.
- **15 mars** — Premiers vrais problèmes d'intégration **front ↔ back** : on aligne les contrats et les en-têtes (PoW, signatures internes).

> Difficulté marquante (documentée dans le README) : un produit visible au catalogue mais « introuvable » au paiement. La vraie cause n'était pas le panier mais une **signature inter-services** calculée sur un corps `undefined` côté GET. Corrigé dans `shared/utils/internal-http.js`.

## Phase 4 — Branchement API et documentation (26 mars)

- **26 mars** — Le front `users` passe par un vrai **client gateway** (catalogue et commandes via l'API). Ajout de la documentation technique (`docs/`), de l'**export PDF** (`npm run docs:pdf`) et du premier **admin-service**. Documentation vendeur et flux d'auth côté `vendors`.

## Phase 5 — Administration et lab de tests (29 mars)

- **29 mars** — Création de l'app `qa-lab` (port 4202) pour tester l'API via la gateway (santé, auth, OTP, produits, commandes, messagerie, IA, « run all »). Côté backend, **AdminJS** gagne les actions d'**approbation/rejet vendeur** et un catalogue Mongo optionnel en lecture seule.

## Phase 6 — Stabilisation backend (7 avril)

- **7 avril** — Finalisation d'**AdminJS**, meilleure gestion des erreurs de configuration et des commandes.

> Pause entre début et mi-avril.

## Phase 7 — Bascule sur l'API réelle (19 avril)

- **19 avril** — Les apps `vendors` et `admin` retirent leurs **données mock** et se branchent à l'API réelle ; redesign de l'admin.

## Phase 8 — Mise au propre avant présentation (juin)

- Uniformisation des **noms en français** côté front (`users`), nettoyage des artefacts d'outils, réécriture du contrat d'API au propre, correction des incohérences de documentation (PoW sur toutes les routes, auth interne HMAC), remplacement de l'app Angular `admin` par **AdminJS** seul, et **commentaires** explicatifs dans le code.

---

### Comment relire cette évolution dans Git

```bash
# dans chaque dépôt
git log --date=short --pretty="%ad  %an  %s"
```

Les auteurs visibles : `Eddy Etame`, `Simone Richelle`, `Brad Mbosseu` (voir `CONTRIBUTORS.md`).
