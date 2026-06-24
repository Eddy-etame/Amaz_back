# Guide d'installation — Place de marché Amaz

Ce guide explique, pas à pas, comment **cloner et lancer la totalité du projet** (back-end,
bases de données **et** les trois front-ends) sur une machine vierge, uniquement avec
**Docker**. Aucune installation de Node, MySQL ou MongoDB n'est nécessaire sur le poste :
tout tourne dans des conteneurs.

> En une phrase : on clone les 4 dépôts côte à côte, on lance `docker compose up`, on
> initialise la base une fois, et tout est en ligne.

---

## 1. Prérequis

| Outil | Version conseillée | Vérifier avec |
|-------|--------------------|---------------|
| **Docker Desktop** (Windows/Mac) ou **Docker Engine + Compose** (Linux) | 24+ | `docker --version` et `docker compose version` |
| **Git** | 2.30+ | `git --version` |

- **Docker Desktop doit être démarré** (icône baleine active) avant toute commande.
- Mémoire allouée à Docker : **4 Go minimum** (Docker Desktop → Settings → Resources).
- **Ports à laisser libres** sur la machine : `3000` (passerelle/API), `3004` (messagerie
  temps réel), `4200`, `4201`, `4202` (les trois front-ends). Les bases (MySQL/Mongo) ne sont
  **pas** exposées sur la machine hôte, il n'y a donc pas de conflit possible avec un MySQL local.

---

## 2. Architecture (ce qu'on installe)

Le projet est réparti en **4 dépôts Git** que l'on place dans **un seul dossier parent** :

```
amaz/                      <-- dossier parent (nom libre)
├── Amaz_back/             <-- back-end : passerelle + microservices + bases + Docker Compose
├── users/                 <-- front-end ACHETEUR        (Angular)  -> http://localhost:4200
├── vendors/               <-- front-end VENDEUR          (Angular)  -> http://localhost:4201
└── qa-lab/                <-- front-end LAB DE TESTS QA   (Angular)  -> http://localhost:4202
```

> ⚠️ **Important : les dossiers des front-ends doivent s'appeler exactement `users`, `vendors`
> et `qa-lab`.** Le fichier `docker-compose.full.yml` les référence par ces noms
> (`context: ../users`, etc.). Les commandes de clonage ci-dessous s'en chargent.

Le back-end est composé de la passerelle (gateway) et de microservices indépendants
(utilisateurs, produits, commandes, messagerie, IA/recommandations, service « pepper » de
sécurité, retours). Deux bases de données : **MySQL** (utilisateurs, commandes, retours…) et
**MongoDB** (catalogue produits).

---

## 3. Étape 1 — Cloner les 4 dépôts dans un même dossier

Ouvrez un terminal, placez-vous dans le dossier où vous voulez tout installer, puis :

```bash
# 1. Créer et entrer dans le dossier parent
mkdir amaz
cd amaz

# 2. Cloner les 4 dépôts DANS LES BONS NOMS DE DOSSIER
git clone https://github.com/Eddy-etame/Amaz_back.git           Amaz_back
git clone https://github.com/Eddy-etame/Rep_Amazon.git          users
git clone https://github.com/Eddy-etame/Rep_Amazon-Vendors.git  vendors
git clone https://github.com/Eddy-etame/Rep_Amazon-qa-lab.git   qa-lab
```

Le dernier mot de chaque commande (`Amaz_back`, `users`, `vendors`, `qa-lab`) force le nom du
dossier local : c'est ce qui garantit que Docker Compose retrouvera les front-ends.

---

## 4. Étape 2 — Se placer sur les bonnes branches

Chaque dépôt a une branche de référence pour cette version :

```bash
cd Amaz_back && git checkout integration-mysql && cd ..
cd users     && git checkout eddy              && cd ..
cd vendors   && git checkout brad              && cd ..
cd qa-lab    && git checkout main              && cd ..
```

| Dépôt | Branche |
|-------|---------|
| Amaz_back | `integration-mysql` |
| users | `eddy` |
| vendors | `brad` |
| qa-lab | `main` |

---

## 5. Étape 3 — Configurer l'environnement

Le back-end lit ses secrets et paramètres dans un fichier `.env`. Un modèle prêt à l'emploi
est fourni :

```bash
cd Amaz_back
cp .env.example .env        # Windows PowerShell : Copy-Item .env.example .env
```

Les valeurs par défaut conviennent pour une démonstration locale ; **aucune modification
n'est nécessaire** pour démarrer.

---

## 6. Étape 4 — Construire et démarrer toute la plateforme

Toujours depuis `Amaz_back/` :

```bash
docker compose -f docker-compose.full.yml up -d --build
```

Cette commande construit puis démarre **15 conteneurs** : les 2 bases (MySQL, MongoDB), les 9 services back-end, la passerelle (gateway), le back-office d'administration (AdminJS), et les **3 front-ends**.

> ⏱️ Le **premier** lancement télécharge les images et compile les 3 applications Angular :
> comptez **plusieurs minutes**. Les fois suivantes, c'est quasi instantané (cache Docker).

### 🚀 Initialisation et Seeding Automatiques
Le processus de **bootstrap** (création des tables, migrations et chargement des 455 produits du catalogue) s'exécute désormais **automatiquement** lors du démarrage. Vous n'avez aucune commande manuelle à lancer pour peupler votre base !

Vérifier que tout est en cours de démarrage et « healthy » :

```bash
docker compose -f docker-compose.full.yml ps
```

---

## 7. Étape 5 — Mise à jour et Réinitialisation (Idempotence)

Grâce à la mise à jour du script de bootstrap, l'initialisation de la base est **totalement idempotente**. Cela signifie que :

*   **Si vous n'avez jamais cloné (nouvelle installation)** : La base est créée, configurée et entièrement peuplée automatiquement dès le premier `docker compose up`.
*   **Si vous avez déjà cloné (mise à jour)** : Récupérez simplement les dernières modifications (`git pull`) et relancez la plateforme avec `docker compose -f docker-compose.full.yml up -d --build`. Le système détectera les tables et colonnes existantes, appliquera uniquement les nouvelles migrations sans écraser vos données existantes, et s'assurera que le catalogue de produits est à jour.

### Réinitialisation complète (repartir de zéro)
Si vous souhaitez vider complètement les bases de données et re-sécuriser le catalogue à son état d'origine, exécutez :
```bash
# Arrêter la plateforme et supprimer les volumes de stockage des bases de données
docker compose -f docker-compose.full.yml down -v

# Relancer : le bootstrap automatique se chargera de tout recréer proprement
docker compose -f docker-compose.full.yml up -d --build
```

---

## 8. Étape 6 — Accéder aux applications

| Application | URL | Description |
|-------------|-----|-------------|
| **Boutique (acheteur)** | http://localhost:4200 | Catalogue, panier, commandes, favoris |
| **Console vendeur** | http://localhost:4201 | Produits, commandes reçues, retours |
| **Console d'administration (AdminJS)** | http://localhost:3010/admin | Suivi technique, approbation vendeurs, logs sécurité |
| **Lab de tests QA** | http://localhost:4202 | Banc d'essai des parcours techniques |
| **API / passerelle** | http://localhost:3000 | Point d'entrée unique du back-end |
| Santé globale de l'API | http://localhost:3000/health/aggregate | Doit afficher tous les services « ok » |

### Comptes de démonstration

Tous créés par le bootstrap. Mot de passe par défaut : **`Amaz@2026!`**

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Acheteur | `eddy.eetame@gmail.com` | `Amaz@2026!` |
| Acheteur | `drdavid10000@gmail.com` | `Amaz@2026!` |
| **Vendeur** | `etame.eddy01@gmail.com` | `Amaz@2026!` |
| **Admin** | `admin@amaz.local` | `Amaz@2026!` |
| Compte de test QA | `test@amaz.com` | `AmazQA2026!` |

---

## 9. Vérifier que tout fonctionne

1. Ouvrir http://localhost:4200 → le catalogue s'affiche **avec les produits et les images**.
2. Ouvrir http://localhost:3000/health/aggregate → tous les services répondent « ok ».
3. Se connecter avec un compte acheteur, ajouter un produit au panier, passer une commande.
4. Se connecter à la console vendeur (http://localhost:4201) avec le compte vendeur.

---

## 10. Commandes utiles

```bash
# Voir les logs en direct (tous les services)
docker compose -f docker-compose.full.yml logs -f

# Logs d'un seul service (ex. recommandations IA)
docker compose -f docker-compose.full.yml logs -f ai-service

# Arrêter la plateforme (les données restent)
docker compose -f docker-compose.full.yml down

# Tout relancer (sans reconstruire)
docker compose -f docker-compose.full.yml up -d

# Déclencher manuellement le bootstrap (si nécessaire)
docker compose -f docker-compose.full.yml run --rm bootstrap
```

---

## 11. Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `Cannot connect to the Docker daemon` | Docker Desktop n'est pas démarré | Lancer Docker Desktop, attendre l'icône active |
| `port is already allocated` (3000/4200…) | Un autre programme occupe le port | Fermer le programme, ou modifier le port dans `docker-compose.full.yml` |
| Le catalogue est vide sur http://localhost:4200 | Le bootstrap n'a pas été lancé | Exécuter la commande de l'**Étape 5** |
| `failed to read ../users` au build | Front-ends mal nommés ou absents | Vérifier que `users`, `vendors`, `qa-lab` sont bien à côté de `Amaz_back` (Étape 1) |
| Un service reste « unhealthy » | Démarrage encore en cours | Attendre 30 s, puis `docker compose ... ps` ; sinon voir les logs du service |
| Build Angular très long la 1re fois | Compilation initiale normale | Patienter ; les builds suivants sont mis en cache |

---

## 12. Récapitulatif express (pour les pressés)

```bash
mkdir amaz && cd amaz
git clone https://github.com/Eddy-etame/Amaz_back.git           Amaz_back
git clone https://github.com/Eddy-etame/Rep_Amazon.git          users
git clone https://github.com/Eddy-etame/Rep_Amazon-Vendors.git  vendors
git clone https://github.com/Eddy-etame/Rep_Amazon-qa-lab.git   qa-lab
cd Amaz_back && git checkout integration-mysql && cd ..
cd users && git checkout eddy && cd .. && cd vendors && git checkout brad && cd ..
cd Amaz_back
cp .env.example .env
docker compose -f docker-compose.full.yml up -d --build
# Le bootstrap s'exécute automatiquement en arrière-plan !
# Accès direct :
#   -> http://localhost:4200 (Boutique)
#   -> http://localhost:3010/admin (Console AdminJS)
#   -> http://localhost:3000/health/aggregate (API)
```
