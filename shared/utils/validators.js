// Petits validateurs réutilisés par les services (formes simples, pas de logique métier).

// Vérifie que tous les champs `fields` sont présents et non vides dans `payload`.
// Renvoie la liste des manquants pour pouvoir l'afficher dans l'erreur.
function requireFields(payload, fields) {
  const missing = fields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  return {
    ok: missing.length === 0,
    missing
  };
}

// Validation d'email volontairement simple (un @ et un domaine).
function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

// Téléphone au format international tolérant (+ optionnel, 8 à 15 chiffres).
function isPhone(value) {
  return /^\+?[1-9][0-9]{7,14}$/.test(String(value || '').trim());
}

// Canal de notification autorisé pour les OTP.
function isAllowedChannel(value) {
  return value === 'email' || value === 'sms';
}

module.exports = {
  requireFields,
  isEmail,
  isPhone,
  isAllowedChannel
};
