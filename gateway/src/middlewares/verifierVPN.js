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