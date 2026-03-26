# Documentation technique Amaz (`Amaz_back/docs`)

## Par où commencer

- **Récit global / mémoire** : [PLAN_MEMOIRE_DOCUMENTATION.md](PLAN_MEMOIRE_DOCUMENTATION.md)
- **Manuel utilisateur (non dev)** : [MANUEL_UTILISATEUR.md](MANUEL_UTILISATEUR.md)
- **Cartographie API ↔ front** : [MICROSERVICES_FRONTEND_MAP.md](MICROSERVICES_FRONTEND_MAP.md)
- **Vérifs locales** : [VERIFY.md](VERIFY.md)

## Microservices (une fiche par service)

Dossier [services/](services/) — table d’ensemble dans [services/README.md](services/README.md) (ports, rôle, lien PDF).

## Applications Angular

Dossier [apps/](apps/) — users, vendors, qa-lab.

## PDF pour remise

Les PDF ne sont **pas** édités à la main : ils sont générés dans **`docs/pdf/`** à la racine du dépôt (dossier frère de `Amaz_back`).

```bash
cd Amaz_back
npm run docs:pdf
```

Voir aussi [../../docs/pdf/README.md](../../docs/pdf/README.md).
