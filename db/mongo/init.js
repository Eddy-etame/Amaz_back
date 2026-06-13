const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { getMongoDb, closeMongo } = require('../../shared/db/mongo');

/** Distinct marketplace sellers (IDs stable for messagerie / commandes). */
const SEED_VENDORS = [
  { id: 'vnd_electro_horizon', name: 'Electro Horizon SAS' },
  { id: 'vnd_maison_lyon', name: 'Maison & Confort Lyon' },
  { id: 'vnd_mode_atelier', name: 'Atelier Mode 12' },
  { id: 'vnd_tech_stream', name: 'TechStream Distribution' },
  { id: 'vnd_cuisine_pro_fr', name: 'Cuisine Pro France' },
  { id: 'vnd_jardin_vert', name: 'Jardin Vert SARL' },
  { id: 'vnd_sport_pulse', name: 'Sport Pulse Europe' },
  { id: 'vnd_beaute_lumiere', name: 'Beauté Lumière' },
  { id: 'vnd_auto_route', name: 'Auto Route Pièces' },
  { id: 'vnd_bebe_etoile', name: 'Bébé Étoile' },
  { id: 'vnd_livres_quais', name: 'Librairie des Quais' },
  { id: 'vnd_animaux_compagnie', name: 'Animaux & Compagnie' },
  { id: 'vnd_brico_solide', name: 'Brico Solide Pro' },
  { id: 'vnd_informatique_net', name: 'Informatique Net 37' },
  { id: 'vnd_market_nantes', name: 'Nantes Market Place' },
  { id: 'vnd_paris_outlet', name: 'Paris Outlet Store' },
  { id: 'vnd_marseille_trade', name: 'Marseille Trade Co.' },
  { id: 'vnd_toulouse_shop', name: 'Toulouse Shop EU' },
  { id: 'vnd_nice_luxe', name: 'Nice Luxe Retail' },
  { id: 'vnd_strasbourg_ok', name: 'Strasbourg OK Commerce' },
  { id: 'vnd_bordeaux_sel', name: 'Bordeaux Sélection' },
  { id: 'vnd_lille_nord', name: 'Lille Nord Vendeurs' },
  { id: 'vnd_rennes_digital', name: 'Rennes Digital Hub' },
  { id: 'vnd_lyon_gadget', name: 'Lyon Gadget & Co' },
  { id: 'vnd_etame_seed', name: 'Étamé Seed (démo)' },
  { id: 'vnd_dupont_sas', name: 'SAS Dupont & Fils' },
  { id: 'vnd_martin_elec', name: 'Martin Électroménager' },
  { id: 'vnd_bernard_loisirs', name: 'Bernard Loisirs' },
  { id: 'vnd_petit_commerce', name: 'Le Petit Commerce Bio' },
  { id: 'vnd_grand_large', name: 'Grand Large Import' },
  { id: 'vnd_cote_ouest', name: 'Côte Ouest Retail' },
  { id: 'vnd_alpes_outdoor', name: 'Alpes Outdoor Pro' },
  { id: 'vnd_med_rhone', name: 'Méditerranée Rhône SARL' },
  { id: 'vnd_nordic_home', name: 'Nordic Home FR' },
  { id: 'vnd_urban_supply', name: 'Urban Supply Europe' },
  { id: 'vnd_green_cart', name: 'Green Cart Marketplace' },
  { id: 'vnd_fast_ship', name: 'FastShip Vendeurs' }
];

function pickVendor(globalIndex) {
  return SEED_VENDORS[globalIndex % SEED_VENDORS.length];
}

/** `products-mock.store.ts` stores amounts in centimes (1/100 €). */
function mockCentsToEuros(cents) {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) {
    return 0;
  }
  return Math.round(c) / 100;
}

function buildSku(title, index) {
  const slug = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
  return `SKU-${slug || 'PROD'}-${String(index + 1).padStart(3, '0')}`;
}

function buildStock(index) {
  const pattern = [18, 24, 11, 32, 15, 9, 27, 13, 21, 8];
  return pattern[index % pattern.length];
}

function buildLowStockThreshold(index) {
  const pattern = [5, 6, 4, 8, 5, 3];
  return pattern[index % pattern.length];
}

function resolveMonorepoRoot() {
  if (process.env.MONOREPO_ROOT) {
    return path.resolve(process.env.MONOREPO_ROOT);
  }
  // Amaz_back/db/mongo -> ../../.. = repo root (sibling `users/` app)
  return path.resolve(__dirname, '../../..');
}

function parseLegacyProducts() {
  const sourcePath = path.join(
    resolveMonorepoRoot(),
    'users/src/app/core/services/products-mock.store.ts'
  );
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(
    /signal<ProductMock\[\]>\(\s*\[(?<items>[\s\S]*?)\]\s*\);\s*readonly products/s
  );

  if (!match?.groups?.items) {
    throw new Error(
      'Unable to parse users products mock store. Ensure users/src/app/core/services/products-mock.store.ts exists and contains the expected signal structure.'
    );
  }

  const evaluateProducts = new Function(
    'Date',
    `'use strict'; return [${match.groups.items}];`
  );

  return evaluateProducts(Date);
}

const GEN_CATEGORIES = [
  'Électronique',
  'Mode',
  'Cuisine',
  'Informatique',
  'Maison',
  'Sports',
  'Beauté',
  'Jardin',
  'Auto',
  'Bébé',
  'Livres',
  'Animalerie',
  'Bricolage'
];

const GEN_CITIES = [
  'Paris',
  'Lyon',
  'Marseille',
  'Toulouse',
  'Nice',
  'Nantes',
  'Strasbourg',
  'Bordeaux',
  'Lille',
  'Rennes'
];

/**
 * Per category: names + images + **pricesEUR** (one reference retail price in € per name, same order).
 * Prices are typical EU mass‑retail / marketplace ballparks (not live APIs); variants in seed add small bumps.
 */
const CATEGORY_THEMES = {
  Électronique: {
    names: [
      'Écouteurs sans fil ANC',
      'Enceinte Bluetooth portable',
      'Montre connectée sport',
      'Souris ergonomique sans fil',
      'Clavier mécanique rétroéclairé',
      'Tablette 11" Wi‑Fi',
      'Hub USB‑C 7 ports',
      'Webcam Full HD 1080p',
      'SSD externe 1 To USB‑C',
      'Chargeur rapide GaN 65 W',
      'Drone pliable 4K',
      'Barre de son 2.1',
      'Liseuse lumière chaude',
      'Caméra d’action étanche',
      'Câble USB‑C tressé 2 m'
    ],
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544117519-31a4b719224d?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [149, 79, 199, 45, 119, 429, 49, 69, 89, 35, 699, 179, 139, 329, 19]
  },
  Mode: {
    names: [
      'Baskets running amorti',
      'Sac cabas cuir végétal',
      'Manteau laine mi-long',
      'Jean slim stretch',
      'Chemise lin bleu',
      'Robe midi fleurie',
      'Ceinture cuir noir',
      'Écharpe cachemire',
      'Lunettes de soleil polarisées',
      'Parka imperméable',
      'Pull col roulé mérinos',
      'Sandales plates cuir',
      'Blazer ajusté',
      'Legging sport respirant',
      'Casquette brodée'
    ],
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [95, 189, 259, 79, 65, 89, 45, 79, 129, 199, 89, 75, 139, 45, 29]
  },
  Cuisine: {
    names: [
      'Casserole inox 24 cm',
      'Couteau chef forgé',
      'Machine à café expresso',
      'Robot multifonction',
      'Poêle antiadhésive 28 cm',
      'Set bols porcelaine',
      'Balance cuisine digitale',
      'Planche à découper bambou',
      'Mixeur plongeant 800 W',
      'Théière fonte 1 L',
      'Moule à manqué silicone',
      'Lunch box isotherme',
      'Carafe filtrante 2,4 L',
      'Distributeur huile/vinaigre',
      'Presse-agrumes électrique'
    ],
    images: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584990349675-067b6aed9294?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [45, 89, 399, 249, 42, 55, 25, 22, 59, 65, 15, 28, 35, 18, 45]
  },
  Informatique: {
    names: [
      'PC portable 15" ultrafin',
      'Écran 27" QHD IPS',
      'Clavier sans fil silencieux',
      'Souris verticale ergonomique',
      'NAS 2 baies domestique',
      'Imprimante jet d’encre Wi‑Fi',
      'Switch Ethernet 8 ports',
      'Disque dur interne 2 To',
      'RAM DDR5 32 Go',
      'Carte graphique gaming',
      'Sac à dos PC 15,6"',
      'Support écran articulé',
      'Dock Thunderbolt 4',
      'Routeur Wi‑Fi 6',
      'Onduleur line-interactive'
    ],
    images: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1593640408182-31dec13737a7?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [899, 299, 49, 59, 319, 89, 35, 65, 119, 549, 45, 89, 229, 139, 119]
  },
  Maison: {
    names: [
      'Canapé 3 places tissu',
      'Lampe de lecture LED',
      'Coussin décoratif velours',
      'Tapis laine tissé main',
      'Horloge murale silencieuse',
      'Plaid tricoté',
      'Étagère murale bois',
      'Miroir rond 80 cm',
      'Panier rangement jute',
      'Diffuseur huiles essentielles',
      'Housse de couette coton',
      'Tabouret bar métal',
      'Vase céramique mat',
      'Rideaux occultants',
      'Porte-manteau mural'
    ],
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [799, 45, 25, 289, 39, 49, 79, 129, 22, 35, 65, 89, 32, 119, 45]
  },
  Sports: {
    names: [
      'Tapis de yoga antidérapant',
      'Haltères ajustables 20 kg',
      'Vélo d’appartement magnétique',
      'Corde à sauter vitesse',
      'Gourde isotherme 750 ml',
      'Ballon de football FIFA',
      'Raquette tennis graphite',
      'Masque de ski double écran',
      'Sac de sport 40 L',
      'Montre GPS trail',
      'Foam roller massage',
      'Gants musculation cuir',
      'Skateboard complet 8"',
      'Palmes plongée réglables',
      'Élastiques fitness set'
    ],
    images: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1594882645126-14020914d58d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1461896836934-a6c8223c21c5?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [35, 89, 349, 15, 28, 25, 119, 89, 45, 299, 32, 29, 95, 65, 22]
  },
  Beauté: {
    names: [
      'Sérum vitamine C 30 ml',
      'Crème hydratante SPF 50',
      'Palette fards à paupières',
      'Parfum eau de toilette 100 ml',
      'Huile démaquillante douce',
      'Mascara volume waterproof',
      'Rouge à lèvres mat longue tenue',
      'Brosse nettoyante visage',
      'Shampoing réparateur 400 ml',
      'Gommage corps au sucre',
      'Vernis à ongles gel',
      'Coffret soin homme',
      'Roll-on anti-cernes',
      'Baume à lèvres karité',
      'Spray fixateur maquillage'
    ],
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [42, 28, 38, 65, 22, 15, 32, 89, 12, 18, 9, 45, 28, 6, 16]
  },
  Jardin: {
    names: [
      'Tondeuse électrique 38 cm',
      'Arrosoir galvanisé 10 L',
      'Serre tunnel 2 m',
      'Gants de jardinage cuir',
      'Graines potager bio assorties',
      'Bâche protection hiver',
      'Pots terre cuite lot 3',
      'Sécateur pro à crémaillère',
      'Tuyau d’arrosage 25 m',
      'Banc de jardin bois',
      'Lampes solaires LED',
      'Composteur 300 L',
      'Taille-haies sans fil',
      'Engrais naturel 5 kg',
      'Brouette 1 roue 80 L'
    ],
    images: [
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1466692476869-aef1dfb1e735?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584479898061-157f0e1a9a7e?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [189, 35, 129, 18, 12, 45, 24, 32, 42, 189, 28, 89, 149, 22, 89]
  },
  Auto: {
    names: [
      'Coffre de toit 400 L',
      'Tapis caoutchouc sur mesure',
      'Chargeur allume-cigare USB‑C',
      'Cire carnauba premium',
      'Dashcam avant/arrière',
      'Huile moteur 5W‑30 5 L',
      'Gilet et triangle signalisation',
      'Compresseur portable 12 V',
      'Antivol volant',
      'Siège auto groupe 1/2/3',
      'Balais d’essuie-glace',
      'Organiseur siège arrière',
      'Parfum voiture clip',
      'Câble démarrage 3 m',
      'Housse siège universelle'
    ],
    /** One image per `names` index (accessory-themed, not random sports cars). */
    images: [
      'https://images.unsplash.com/photo-1504274066651-8d31a536b11a?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1619406559017-2351741de4d9?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1617185994949-ef1557e8aa36?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1601362840462-5844f2202b07?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1580048325464-f03ae2b12e24?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1631541909061-7e490b6b5cde?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1612830719875-5e6a5363a1ab?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507136566000-3873dbca0e4d?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [389, 75, 22, 28, 119, 42, 35, 45, 38, 189, 25, 18, 8, 35, 45]
  },
  Bébé: {
    names: [
      'Poussette citadine pliable',
      'Lit parapluie avec matelas',
      'Lot bodies coton 5 pièces',
      'Veilleuse musicale peluche',
      'Chaise haute évolutive',
      'Biberons anti-colique lot 3',
      'Baby-phone vidéo HD',
      'Tapis d’éveil sensoriel',
      'Porte-bébé physiologique',
      'Thermomètre bain digital',
      'Coffret naissance bio',
      'Stérilisateur micro-ondes',
      'Hochet dentition silicone',
      'Sac à langer imperméable',
      'Balance bébé connectée'
    ],
    images: [
      'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544124094-8aea0798c1e8?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [279, 89, 32, 28, 159, 24, 129, 65, 89, 18, 45, 55, 12, 65, 45]
  },
  Livres: {
    names: [
      'Roman policier best-seller',
      'Essai société contemporaine',
      'BD historique couleur',
      'Cuisine du monde illustré',
      'Manga shōnen volume relié',
      'Livre jeunesse 8‑12 ans',
      'Guide voyage France',
      'Poésie classique annotée',
      'Thriller nordique',
      'Manuel photo noir & blanc',
      'Livre de coloriage adulte',
      'Atlas mondial 2025',
      'Biographie entrepreneur',
      'Contes illustrés luxe',
      'Cahier d’activités Montessori'
    ],
    images: [
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1524578271613-d550eacf609d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1526243741027-444d633d7365?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [22, 24, 16, 32, 14, 12, 24, 15, 21, 45, 14, 39, 26, 35, 18]
  },
  Animalerie: {
    names: [
      'Croquettes chien adulte 12 kg',
      'Arbre à chat 1,5 m',
      'Laisse rétractable 5 m',
      'Aquarium 60 L complet',
      'Jouet interactif chien',
      'Litière agglomérante 10 L',
      'Cage transport chat',
      'Shampoing poils longs',
      'Gamelle double inox',
      'Harnais chien réfléchissant',
      'Filtre aquarium extérieur',
      'Snack dentaire chiot',
      'Coussin orthopédique chien',
      'Perchoir oiseaux bois',
      'Pelle litière ergonomique'
    ],
    images: [
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1530281700549-e82e7bf210d4?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [52, 89, 25, 149, 15, 18, 45, 12, 22, 28, 35, 8, 55, 32, 9]
  },
  Bricolage: {
    names: [
      'Perceuse-visseuse 18 V',
      'Boîte à outils 120 pièces',
      'Niveau laser croix',
      'Échelle télescopique aluminium',
      'Masque protection FFP2 lot 10',
      'Scie sauteuse pendulaire',
      'Multimètre digital',
      'Pistolet à colle chaude',
      'Ensemble tournevis précision',
      'Aspirateur chantier 1400 W',
      'Serre-joints 60 cm',
      'Rouleau peinture pro',
      'Détecteur de studs',
      'Caisse à outils vide métal',
      'Gants travail cuir renforcé'
    ],
    images: [
      'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1581147036324-c1a02d69e455?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1530124566582-a618ec2616c2?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=85&auto=format&fit=crop'
    ],
    pricesEUR: [129, 79, 45, 119, 12, 89, 35, 22, 35, 149, 28, 8, 25, 65, 22]
  }
};

/**
 * Append 420 generated products so total catalog exceeds 400 with broad categories.
 * Titles, images and **pricesEUR** per product line; variants get small deterministic bumps.
 * @param {number} legacyCount — number of legacy rows (for SKU index offset).
 */
function generateBulkProducts(legacyCount) {
  const TARGET = 420;
  const out = [];
  const baseTime = Date.now();

  for (let i = 0; i < TARGET; i++) {
    const globalIndex = legacyCount + i;
    const category = GEN_CATEGORIES[i % GEN_CATEGORIES.length];
    const theme = CATEGORY_THEMES[category];
    const city = GEN_CITIES[i % GEN_CITIES.length];
    const nameSlot = i % theme.names.length;
    const nameBase = theme.names[nameSlot];
    const variant = Math.floor(i / theme.names.length) % 48;
    const title = variant > 0 ? `${nameBase} — mod. ${variant + 1}` : nameBase;
    const list = theme.pricesEUR;
    const basePrice = list[nameSlot % list.length];
    const variantBump =
      variant > 0 ? 1 + variant * 0.018 + (globalIndex % 5) * 0.004 : 1;
    const price = Math.round(basePrice * variantBump * 100) / 100;
    const strikethrough =
      price >= 35 && i % 6 === 0 ? Math.round(price * 1.12 * 100) / 100 : null;
    const shortDescription = `${title}. Neuf, emballage soigné. Catégorie ${category}.`;
    const detailedDescription = `${shortDescription} Expédition depuis ${city}. Vendeur vérifié Amaz démo — satisfait ou remboursé 30 jours sur articles éligibles.`;
    const imgs = theme.images;
    const image = imgs[nameSlot % imgs.length];
    const createdAt = new Date(baseTime - i * 60_000).toISOString();
    const vendor = pickVendor(globalIndex);

    out.push({
      id: `prd_gen_${String(i + 1).padStart(4, '0')}`,
      title,
      description: `${shortDescription}\n\n${detailedDescription}`,
      shortDescription,
      detailedDescription,
      price,
      category,
      city,
      stock: buildStock(globalIndex),
      lowStockThreshold: buildLowStockThreshold(globalIndex),
      image,
      gallery: [image],
      vendorId: vendor.id,
      nomVendeur: vendor.name,
      status: 'published',
      sku: buildSku(title, globalIndex),
      rating: Math.min(5, 3.5 + (i % 5) * 0.25),
      reviewCount: 24 + (i % 380),
      strikethroughPrice: strikethrough,
      freeShipping: i % 4 === 0,
      createdAt,
      updatedAt: new Date().toISOString()
    });
  }

  return out;
}

function mapLegacyProduct(product, index) {
  const title = String(product.titre || '').trim();
  const shortDescription = String(product.descriptionCourte || '').trim();
  const detailedDescription = String(product.descriptionDetaillee || '').trim();
  const vendor = pickVendor(index);

  return {
    id: `prd_seed_${String(index + 1).padStart(3, '0')}`,
    title,
    description: [shortDescription, detailedDescription].filter(Boolean).join('\n\n'),
    shortDescription,
    detailedDescription,
    price: mockCentsToEuros(product.prix),
    category: String(product.categorie || 'Général'),
    city: String(product.ville || ''),
    stock: buildStock(index),
    lowStockThreshold: buildLowStockThreshold(index),
    image: String(product.imagePrincipale || ''),
    gallery: Array.isArray(product.galerie) ? product.galerie.filter(Boolean) : [],
    vendorId: vendor.id,
    nomVendeur: vendor.name,
    status: 'published',
    sku: buildSku(title, index),
    rating: Number(product.note || 0),
    reviewCount: Number(product.nbAvis || 0),
    strikethroughPrice:
      product.prixBarre === null || product.prixBarre === undefined
        ? null
        : mockCentsToEuros(product.prixBarre),
    freeShipping: Boolean(product.livraisonGratuite),
    createdAt: new Date(Number(product.createdAt || Date.now())).toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function main() {
  const legacyProducts = parseLegacyProducts();
  const legacyMapped = legacyProducts.map(mapLegacyProduct);
  const generated = generateBulkProducts(legacyMapped.length);
  const products = [...legacyMapped, ...generated];

  const db = await getMongoDb();
  const collection = db.collection('products');

  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ vendorId: 1, status: 1 });
  await collection.createIndex({ category: 1, city: 1 });

  let upserted = 0;
  for (const product of products) {
    const result = await collection.updateOne(
      { id: product.id },
      {
        $set: product
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      upserted += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ok: true,
      collection: 'products',
      totalSeedProducts: products.length,
      upserted,
      vendorPool: SEED_VENDORS.length
    })
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        ok: false,
        error: error.message
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo().catch(() => undefined);
  });
