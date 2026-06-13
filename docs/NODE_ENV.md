# NODE_ENV : Développement vs Production

## Rôle de NODE_ENV

`NODE_ENV` est une variable d'environnement standard de Node.js qui indique le mode d'exécution. Elle affecte la journalisation, le détail des erreurs, le cache et les **vérifications de sécurité** dans ce projet.

## Développement vs Production

| Aspect | `development` | `production` |
|--------|---------------|--------------|
| **Secrets placeholder** | Autorisés (ex. `change-pepper-master-secret`) | **Rejetés** — l'app lève une erreur et s'arrête |
| **Messages d'erreur** | Plus verbeux (traces de pile, codes internes) | Assainis (ex. « unreachable » au lieu de ECONNREFUSED) |
| **Journalisation** | Niveau debug, sortie plus abondante | Généralement info/warn uniquement |
| **Performance** | Peut ignorer certaines optimisations | Cache, minification, etc. |

## Pourquoi utiliser le mode développement dans Docker (avec les secrets par défaut)

Quand on lance `docker compose -f docker-compose.full.yml up` **sans** définir de vrais secrets dans `.env`, les services utilisent des valeurs placeholder comme :

- `INTERNAL_SHARED_SECRET=change-this-internal-secret`
- `PEPPER_MASTER_SECRET=change-pepper-master-secret`
- `ACCESS_HMAC_SECRET=change-access-hmac-secret`

Le helper `requiredSecret()` dans chaque service vérifie :

```javascript
if (process.env.NODE_ENV === 'production' && value.startsWith('change-')) {
  throw new Error(`Secret ${name} still uses placeholder value`);
}
```

Résultat :

- **`NODE_ENV=production`** + placeholder → l'app **plante au démarrage**
- **`NODE_ENV=development`** + placeholder → l'app **démarre** (usage local/dev uniquement)

## Quand utiliser le mode production

Utiliser `NODE_ENV=production` quand :

1. On dispose de **vrais secrets** (ne commençant pas par `change-`)
2. On déploie sur un environnement réel (staging, production)
3. On souhaite une sécurité plus stricte et des erreurs moins verbeuses

## Résumé

| Scénario | NODE_ENV | Secrets |
|----------|----------|---------|
| Dev local, Docker avec les défauts | `development` | Placeholders OK |
| Déploiement production | `production` | Vrais secrets obligatoires |
