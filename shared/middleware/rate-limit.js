function limiteurderequetes(req, res, next) {

  const limiteRequetes = 30;
// je définis le nombre maximum de requêtes autorisées
  const duree = 60000;
// je définis la durée de la limite : 60000 millisecondes = 1 minute
  const compteurRequetes = {};
// je crée un objet qui va stocker le nombre de requêtes pour chaque utilisateur
  const listeNoire = [];
// je crée une listenoir des IP ou tokens bannis
  return function(req, res, next) {

    const adresseIP = req.ip;
// je récupère l'adresse IP de l'utilisateur
    const tokenUtilisateur = req.headers.authorization;
// je récupère le token si l'utilisateur est connecté
    let identifiant;

    if (tokenUtilisateur) {
      identifiant = tokenUtilisateur.split(' ')[1]; // Supposons que le token est dans le format "Bearer <token>"
    } else {
      identifiant = adresseIP;
    }


    if (listeNoire.includes(identifiant)) {
      return res.status(403).send("Utilisateur banni");
    }
    const tempsActuel = Date.now();

    if (!compteurRequetes[identifiant]) {
      compteurRequetes[identifiant] = {
        nombre: 1,
        finTemps: tempsActuel + duree
      };
      return next();
    }
    const donneesUtilisateur = compteurRequetes[identifiant];

    if (tempsActuel > donneesUtilisateur.finTemps) {
      donneesUtilisateur.nombre = 1;
      donneesUtilisateur.finTemps = tempsActuel + duree;
      return next();
    }
    donneesUtilisateur.nombre++;

    if (donneesUtilisateur.nombre > limiteRequetes) {
      listeNoire.push(identifiant);
      return res.status(429).send("Trop de requêtes, veuillez réessayer plus tard");
    }
    return next();
  };
}

module.exports = { limiteurderequetes };

    


