function calculerPaiement(prixProduit) {

  const commission = prixProduit * 0.15;

  const montantVendeur = prixProduit - commission;

  return {
    commission,
    montantVendeur
  };
}

module.exports = calculerPaiement;