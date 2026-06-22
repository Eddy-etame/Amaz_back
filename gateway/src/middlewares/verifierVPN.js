// Middleware « filtrage VPN » : refuse (403) les requêtes dont l'IP figure dans une liste d'IP
// de VPN connues. Volontairement simple (liste codée en dur) — garde-fou de démo.
function verifierVPN(req, res, next) {

  const adresseIP = req.ip;

  const listeVPN = [
    "10.0.0.1",
    "172.16.0.1"
  ];

  if (listeVPN.includes(adresseIP)) {
    return res.status(403).send("VPN non autorisé");
  }

  next();
}

module.exports = verifierVPN;