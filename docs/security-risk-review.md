# Revue Risques Sécurité Backend

## Surface couverte

- API Gateway (`/api/v1/*`) avec PoW obligatoire, rate limiting multi-axes, request-id.
- Auth user-service (register/login/me/refresh/logout/revoke + OTP + reset password).
- Communications inter-services signées HMAC (timestamp + nonce + anti-replay).
- Messagerie strictement acheteur-vendeur (REST + Socket.IO).

## Menaces et contrôles

- **Bruteforce login/OTP**
  - Contrôles : PoW global, rate limit IP/fingerprint/account/endpoint, verrouillage OTP sur tentatives.
  - Risque résiduel : attaques distribuées multi-IP restent possibles sans WAF externe.
- **Replay (HTTP interne / PoW)**
  - Contrôles : nonce + timestamp vérifiés, mémorisation nonce temporelle.
  - Risque résiduel : fenêtre de dérive temporelle encore exploitable si horloge serveur non synchronisée.
- **Détournement de session**
  - Contrôles : fingerprint binding, rotation refresh, révocation persistante DB.
  - Risque résiduel : empreinte insuffisante face à un navigateur cloné exactement.
- **Énumération de comptes**
  - Contrôles : réponses OTP start uniformisées sur compte inconnu/non livrable.
  - Risque résiduel : métadonnées de latence réseau peuvent encore donner un signal.
- **Escalade de privilège**
  - Contrôles : rôle serveur forcé à `user` au signup, vérification ownership sur revoke session.
  - Risque résiduel : endpoints vendeur/admin à couvrir par tests ACL plus exhaustifs.
- **Exposition de secrets**
  - Contrôles : pepper service interne uniquement, validation de secrets critiques au démarrage.
  - Risque résiduel : mauvaise hygiène `.env` hors repo (ops) reste un point sensible.

## Lacunes identifiées à traiter ensuite

- Ajouter un store distribué pour rate-limit/replay (Redis) pour mode multi-instance.
- Ajouter rotation des secrets HMAC avec versionnement (kid interne).
- Ajouter audit trail sur order-service/messaging-service (security_events centralisés).
- Ajouter tests de charge PoW + limites pour vérifier l'UX sous charge réelle.

## Checklist de validation manuelle

- [ ] Register/Login/Refresh/Logout/Revoke fonctionnels en chaînage.
- [ ] Vérification OTP email + SMS avec canal choisi.
- [ ] Forgot password start/confirm/reset valide + expiration.
- [ ] Rejet d'un refresh replay (ancien refresh token réutilisé).
- [ ] Rejet des appels sans PoW valide.
- [ ] Rejet des appels inter-services sans signature valide.
- [ ] Envoi message acheteur→vendeur et vendeur→acheteur en REST + socket.
