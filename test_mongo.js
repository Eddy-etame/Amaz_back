require('dotenv').config();
const { getMongoDb } = require('./shared/db/mongo');

async function testMongo() {
  try {
    const db = await getMongoDb();
    console.log('✅ Connexion MongoDB réussie !');
    
    const collections = await db.listCollections().toArray();
    console.log('✅ Collections dans la base de données :');
    collections.forEach(col => {
      console.log(' -', col.name);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB :', error.message);
    process.exit(1);
  }
}

testMongo();