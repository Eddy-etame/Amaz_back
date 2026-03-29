# Admin service — pointer vers la doc centrale

Fiche détaillée : **[Amaz_back/docs/services/admin-service.md](../docs/services/admin-service.md)**  
Runbook opérationnel : **[Amaz_back/docs/ADMIN_RUNBOOK.md](../docs/ADMIN_RUNBOOK.md)**

Rôle : **AdminJS** sur **PostgreSQL** (port **3010** par défaut), authentification admin via le user-service. Actions enregistrement **vendeur** : approbation / rejet via appels internes signés vers le user-service (audit `security_events`). Catalogue **MongoDB** en lecture seule si `MONGO_URI` est défini.
