const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env')
});

const { createApp } = require('./app');
const { config } = require('./config');

const app = createApp();
app.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`User service listening on ${config.host}:${config.port}`);
});
