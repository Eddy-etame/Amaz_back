# Comment creer le fichier de donnees pour toute l'equipe

Objectif: partager les donnees de ta base avec les autres membres du groupe.

Dans la stack Docker actuelle, il y a deux bases principales:

- MySQL: utilisateurs, commandes, adresses, retours, etc.
- MongoDB: produits, messages, donnees plus flexibles.

Donc un seul fichier ne suffit pas toujours. Le plus propre est de creer deux dumps:

- un fichier `.sql` pour MySQL;
- un fichier `.archive` pour MongoDB.

## 1. Avant de creer les dumps

Il faut d'abord lancer Docker Desktop, puis lancer les conteneurs du backend.

Depuis le dossier:

```txt
C:\Users\hello\Desktop\AMAZ\backend\Amaz_back
```

lancer:

```powershell
docker compose -f docker-compose.full.yml up -d
```

Verifier que les bases sont lancees:

```powershell
docker ps
```

Tu dois voir au moins:

```txt
amaz-mysql
amaz-mongo
```

## 2. Creer automatiquement les fichiers dump

Depuis:

```txt
C:\Users\hello\Desktop\AMAZ\backend\Amaz_back
```

lancer:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-db-dumps.ps1
```

Le script va creer deux fichiers dans:

```txt
backend/Amaz_back/db/dumps
```

Exemple:

```txt
mysql-bd_final_projet_annuel-20260623-101500.sql
mongo-amaz_db-20260623-101500.archive
```

Ce sont ces fichiers que les autres membres peuvent recuperer.

## 3. Restaurer MySQL chez un membre du groupe

Le membre doit d'abord avoir Docker lance et le conteneur `amaz-mysql` actif.

Puis, depuis `backend/Amaz_back`, il lance:

```powershell
docker cp db/dumps/mysql-bd_final_projet_annuel-XXXXXXXX-XXXXXX.sql amaz-mysql:/tmp/mysql-dump.sql
docker exec amaz-mysql sh -c "mysql -uroot -p`"$MYSQL_ROOT_PASSWORD`" `"$MYSQL_DATABASE`" < /tmp/mysql-dump.sql"
```

Remplacer `XXXXXXXX-XXXXXX` par le vrai nom du fichier.

## 4. Restaurer MongoDB chez un membre du groupe

Le membre doit avoir le conteneur `amaz-mongo` actif.

Puis, depuis `backend/Amaz_back`, il lance:

```powershell
docker cp db/dumps/mongo-amaz_db-XXXXXXXX-XXXXXX.archive amaz-mongo:/tmp/mongo-amaz_db.archive
docker exec amaz-mongo mongorestore --archive=/tmp/mongo-amaz_db.archive --drop
```

`--drop` supprime les anciennes collections Mongo avant de restaurer celles du dump.

## 5. Phrase simple pour expliquer au chef de projet

Le fichier dump est une photo de la base de donnees a un moment donne. Pour partager exactement mes donnees avec l'equipe, j'exporte MySQL dans un fichier `.sql` et MongoDB dans un fichier `.archive`. Ensuite, chaque membre peut restaurer ces fichiers dans ses conteneurs Docker locaux.

## 6. Difference entre seed et dump

Seed:

- cree des donnees de demonstration prevues dans le code;
- pratique pour demarrer un projet proprement;
- tout le monde obtient les memes donnees de base.

Dump:

- copie exactement les donnees presentes dans ta base actuelle;
- utile si tu as ajoute des donnees manuellement;
- c'est ce que le chef de projet demande si vous voulez tous avoir exactement ta base.
