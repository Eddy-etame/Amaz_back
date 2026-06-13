// Connexion MongoDB partagée (pilote natif `mongodb`, pas de Mongoose côté services).
//
// Comme pour Postgres, on garde une seule connexion (client + db) par process, créée
// à la première demande. Les services produits/messagerie/ai s'en servent.

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

// Renvoie la base, en se connectant à la première demande (lazy).
async function getMongoDb() {
  if (db) return db;

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB_NAME || 'amaz_db';
  client = new MongoClient(uri, {
    maxPoolSize: 20
  });
  await client.connect();
  db = client.db(dbName);
  return db;
}

// Ferme la connexion (tests / arrêt du service).
async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  getMongoDb,
  closeMongo
};
