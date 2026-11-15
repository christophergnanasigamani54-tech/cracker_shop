'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data'));
const DATABASE_URL_FILE = path.join(DATA_DIR, 'database-url.txt');
const DATABASE_URL = process.env.DATABASE_URL || (
  fs.existsSync(DATABASE_URL_FILE) ? fs.readFileSync(DATABASE_URL_FILE, 'utf8').trim() : ''
);
const pool = new Pool({ connectionString: DATABASE_URL || undefined });

module.exports = { DATABASE_URL, pool };
