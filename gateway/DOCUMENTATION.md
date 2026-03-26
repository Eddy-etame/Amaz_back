# Gateway — documentation emplacement code

Ce fichier est dans le dossier du **code** de la gateway pour qu’on le trouve vite quand on ouvre `Amaz_back/gateway/`.

La fiche complète (routes, variables d’environnement, tableau des proxys) est dans :

**[Amaz_back/docs/services/gateway.md](../docs/services/gateway.md)**

En deux phrases : la gateway écoute sur le port **3000**, applique PoW + rate limit + auth selon les chemins, puis forward vers user / product / order / messaging / ai avec le secret interne partagé.
