const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
console.log("DEBUG CONFIG.JS: DB_HOST is", process.env.DB_HOST);

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    timezone: '+00:00',
    dialectOptions: {
      useUTC: true,
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    operatorAliases: false,
  },

  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    timezone: '+00:00',
    dialectOptions: {
      useUTC: true,
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    operatorAliases: false,
  },
};
