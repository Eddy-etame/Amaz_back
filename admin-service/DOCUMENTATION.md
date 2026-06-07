# Admin service â€” pointer vers la doc centrale

Fiche dÃ©taillÃ©e : **[Amaz_back/docs/services/admin-service.md](../docs/services/admin-service.md)**  
Runbook opÃ©rationnel : **[Amaz_back/docs/ADMIN_RUNBOOK.md](../docs/ADMIN_RUNBOOK.md)**

RÃ´le : **AdminJS** sur **MySQL** (port **3010** par dÃ©faut), authentification admin via le user-service. Actions enregistrement **vendeur** : approbation / rejet via appels internes signÃ©s vers le user-service (audit `security_events`). Catalogue **MongoDB** en lecture seule si `MONGO_URI` est dÃ©fini.

