// Point de démarrage de la gateway.
// Charge le .env, construit l'app Express, lance la surveillance de santé des
// services, puis écoute sur le port configuré.

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { createApp } = require('./app');
const { config } = require('./config');
const { startHealthMonitor } = require('./health-monitor');

const app = createApp();

// Surveillance périodique en tâche de fond : permet le fast-fail (503) quand un
// service est down, plutôt que d'attendre un timeout à chaque requête.
startHealthMonitor(config.services);

app.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Gateway listening on ${config.host}:${config.port}`);
});
