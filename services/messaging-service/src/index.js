const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env')
});

const { createMessagingServer } = require('./app');
const { config } = require('./config');

const { server } = createMessagingServer();
server.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Messaging service listening on ${config.host}:${config.port}${config.socketNamespace}`);
});
