'use strict';

const { pool } = require('./config/database');
const { startServer } = require('./app');

startServer().catch((error) => {
  console.error('Could not start the shop server:', error);
  pool.end().finally(() => process.exit(1));
});
