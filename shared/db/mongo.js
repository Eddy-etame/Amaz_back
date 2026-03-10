const { MongoClient } = require('mongodb');

let client = null;
let db = null;

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
