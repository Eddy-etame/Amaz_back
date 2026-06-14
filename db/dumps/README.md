# Partage des données (dumps)

Git versionne les **scripts de seed** (`db/`), pas le contenu vivant des bases. Deux
façons de donner « les mêmes données » à toute l'équipe :

1. **Le seed (recommandé, déjà dans le dépôt).** Tout le monde lance la même commande
   et obtient le même jeu de données de démo : comptes de test + catalogue (35 produits
   « historiques » dans `db/mongo/products-legacy.json` + produits générés). Voir
   `README.md` du backend → `npm run db:bootstrap`.
2. **Un dump (instantané exact).** Utile seulement si tu as ajouté des données à la main
   (commandes, messages, etc.) que le seed ne reproduit pas. Un dump exige une base
   **en cours d'exécution** : commandes copier-coller ci-dessous. Dépose le fichier
   produit dans ce dossier (`db/dumps/`) et partage-le à l'équipe.

> Important : un dump n'est qu'une **photo** des données à un instant T. Pour des données
> reproductibles et versionnées, préfère le seed.

## MySQL (stack actuelle de l'équipe — base `bd_final_projet_annuel`)

```bash
# Créer le dump (depuis Amaz_back)
mysqldump -u root -p bd_final_projet_annuel > db/dumps/mysql-$(date +%Y%m%d).sql

# Restaurer chez un coéquipier
mysql -u root -p bd_final_projet_annuel < db/dumps/mysql-XXXXXXXX.sql
```

## MongoDB (produits / messages — base `amaz_db`)

```bash
# Avec les outils Mongo installés
mongodump --uri="mongodb://localhost:27017" --db=amaz_db --out=db/dumps/mongo
mongorestore --uri="mongodb://localhost:27017" db/dumps/mongo

# Sans outils installés : via le conteneur Docker
docker exec amaz-mongo mongodump --db=amaz_db --archive > db/dumps/mongo.archive
docker exec -i amaz-mongo mongorestore --archive < db/dumps/mongo.archive
```

## PostgreSQL (uniquement sur la branche `mise-au-propre` — base `amaz_db`)

```bash
pg_dump -h localhost -U amaz -d amaz_db > db/dumps/postgres-$(date +%Y%m%d).sql
psql   -h localhost -U amaz -d amaz_db < db/dumps/postgres-XXXXXXXX.sql
```

## Remarque
Les fichiers de dump peuvent être volumineux et contiennent des données. Tu peux les
committer ici pour les partager facilement à l'équipe (projet scolaire), ou les envoyer
hors dépôt. Ne mets **jamais** de vrais secrets/mot de passe en clair dans un dump partagé.
