# QA Lab (banc de test Angular)

Projet Angular dans `qa-lab/`, sur un port de dev distinct (souvent 4202). Ce n’est pas une app « grand public » : c’est un **laboratoire** pour appeler l’API à travers la gateway, reproduire des scénarios, et montrer au correcteur qu’on sait isoler un bug sans passer par tout le parcours UI.

## Intérêt pédagogique

En cours on nous a montré à tester une API avec Postman ou curl ; ici on garde la **même contrainte réelle** que les apps users/vendors (PoW, CORS, base URL gateway), mais avec une UI minimale ou des composants dédiés aux essais.

## Utilisation typique

1. Démarrer la stack backend (Docker ou `npm` selon ce que vous utilisez en équipe).
2. Lancer la gateway sur 3000.
3. Lancer `ng serve` pour qa-lab en pointant `environment` vers la bonne `apiBaseUrl`.
4. Exécuter un flux (login, GET catalogue, etc.) et noter les codes HTTP / corps JSON.

## Voir aussi

- `qa-lab/DOCUMENTATION.md`
- [VERIFY.md](../VERIFY.md) pour les checks automatisés côté repo
