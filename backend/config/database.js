'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

if (fs.existsSync(ENV_FILE)) {
  for (const rawLine of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = value;
  }
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data'));
const DATABASE_URL_FILE = path.join(DATA_DIR, 'database-url.txt');
const DATABASE_URL = process.env.DATABASE_URL || (
  fs.existsSync(DATABASE_URL_FILE) ? fs.readFileSync(DATABASE_URL_FILE, 'utf8').trim() : ''
);
const pool = new Pool({ connectionString: DATABASE_URL || undefined });

module.exports = { DATABASE_URL, pool };
