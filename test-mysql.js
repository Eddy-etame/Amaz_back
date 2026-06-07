require('dotenv').config();
const { getMysqlPool } = require('./shared/db/mysql');

async function testConnection() {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    console.log('✅ Connexion MySQL réussie !');
    console.log('Résultat du test :', rows[0].result);
    
    const [tables] = await pool.query('SHOW TABLES');
    console.log('✅ Tables dans la base de données :');
    tables.forEach(table => {
      console.log(' -', Object.values(table)[0]);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL :', error.message);
    process.exit(1);
  }
}

testConnection();