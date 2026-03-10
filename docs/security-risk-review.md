# Revue Risques Securite Backend

## Surface couverte

- API Gateway (`/api/v1/*`) avec PoW obligatoire, rate limiting multi-axes, request-id.
- Auth user-service (register/login/me/refresh/logout/revoke + OTP + reset password).
- Communications inter-services signees HMAC (timestamp + nonce + anti-replay).
- Messagerie strictement user-vendor (REST + Socket.IO).

## Menaces et controles

- **Bruteforce login/OTP**
  - Controles: PoW global, rate limit IP/fingerprint/account/endpoint, lock OTP sur tentatives.
  - Risque residuel: attaques distribuees multi-IP restent possibles sans WAF externe.
- **Replay (HTTP interne / PoW)**
  - Controles: nonce + timestamp verifies, memorisation nonce temporelle.
  - Risque residuel: fenetre de derive temporelle encore exploitable si horloge serveur non synchronisee.
- **Session hijacking**
  - Controles: fingerprint binding, rotation refresh, revocation persistante DB.
  - Risque residuel: empreinte insuffisante face a un navigateur clone exact.
- **Enumeration comptes**
  - Controles: reponses OTP start uniformisees sur compte inconnu/non livrable.
  - Risque residuel: metadonnees de latence reseau peuvent encore donner un signal.
- **Escalade de privilege**
  - Controles: role serveur force a `user` au signup, check ownership sur revoke session.
  - Risque residuel: endpoints vendor/admin a couvrir par tests ACL plus exhaustifs.
- **Exposition de secrets**
  - Controles: pepper service interne uniquement, validation de secrets critiques au demarrage.
  - Risque residuel: mauvaise hygiene `.env` hors repo (ops) reste un point sensible.

## Gaps identifies a traiter ensuite

- Ajouter un store distribue pour rate-limit/replay (Redis) pour mode multi-instance.
- Ajouter rotation des secrets HMAC avec versionnement (kid interne).
- Ajouter audit trail sur order-service/messaging-service (security_events centralises).
- Ajouter tests de charge PoW + limites pour verifier UX sous charge reelle.

## Checklist de validation manuelle

- [ ] Register/Login/Refresh/Logout/Revoke fonctionnels en chainage.
- [ ] Verification OTP email + SMS avec canal choisi.
- [ ] Forgot password start/confirm/reset valide + expiration.
- [ ] Rejet d’un refresh replay (ancien refresh token reutilise).
- [ ] Rejet des appels sans PoW valide.
- [ ] Rejet des appels inter-services sans signature valide.
- [ ] Envoi message user->vendor et vendor->user en REST + socket.
