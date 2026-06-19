# Returns service — pointeur vers la doc centrale

Fiche détaillée : **[Amaz_back/docs/services/returns-service.md](../../docs/services/returns-service.md)**

Rôle : flux de retours dédié sur **PostgreSQL** (port **3008** par défaut). Les acheteurs créent des demandes de retour, les vendeurs et admins en gèrent le traitement. Exposé via la gateway sous `/api/v1/retours` et `/api/v1/returns`.
