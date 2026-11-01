import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const [backupArgument, ...expectedArguments] = process.argv.slice(2);
const expectedKeys = ['users', 'clients', 'transactions', 'scores'];
const expected = Object.fromEntries(expectedKeys.map((key, index) => [key, Number(expectedArguments[index])]));
const backupPath = backupArgument ? path.resolve(backupArgument) : '';
const restoreDatabase = `rfm_restore_${Date.now()}_${randomBytes(4).toString('hex')}`;
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
};
const maintenance = new Client({ ...dbConfig, database: process.env.DB_MAINTENANCE_DATABASE || 'postgres' });
let created = false;

async function findPgRestore() {
  if (process.env.PG_RESTORE_PATH) return process.env.PG_RESTORE_PATH;
  if (process.platform !== 'win32') return 'pg_restore';
  const versions = [18, 17, 16, 15, 14, 13, 12];
  for (const version of versions) {
    const candidate = path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'PostgreSQL', String(version), 'bin', 'pg_restore.exe',
    );
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed PostgreSQL client version.
    }
  }
  throw new Error('pg_restore не найден. Установите PostgreSQL client tools или задайте PG_RESTORE_PATH.');
}

async function runRestore(restorePath) {
  const args = [
    '--exit-on-error', '--no-owner', '--no-acl', '--no-password',
    '--host', dbConfig.host,
    '--port', String(dbConfig.port),
    '--username', dbConfig.user,
    '--dbname', restoreDatabase,
    backupPath,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(restorePath, args, {
      env: { ...process.env, PGPASSWORD: dbConfig.password },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`pg_restore завершился с кодом ${code}: ${stderr.trim() || 'ошибка восстановления'}`));
    });
  });
}

try {
  if (!backupPath || expectedArguments.length !== 4 || expectedKeys.some(key => !Number.isInteger(expected[key]) || expected[key] < 0)) {
    throw new Error('Использование: npm run db:verify-backup -- <файл.dump> <users> <clients> <transactions> <scores>');
  }
  if (!dbConfig.password) throw new Error('Не задан DB_PASSWORD.');
  if ((await stat(backupPath)).size === 0) throw new Error('Файл резервной копии пуст.');

  await maintenance.connect();
  await maintenance.query(`CREATE DATABASE "${restoreDatabase}"`);
  created = true;
  await runRestore(await findPgRestore());

  const restored = new Client({ ...dbConfig, database: restoreDatabase });
  try {
    await restored.connect();
    const result = await restored.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM clients) AS clients,
        (SELECT COUNT(*)::int FROM transactions) AS transactions,
        (SELECT COUNT(*)::int FROM rfm_scores) AS scores
    `);
    const actual = result.rows[0];
    for (const key of expectedKeys) {
      if (actual[key] !== expected[key]) {
        throw new Error(`Восстановленная таблица ${key}: ожидалось ${expected[key]}, получено ${actual[key]}.`);
      }
    }
    console.log(`PASS backup restored and validated: ${actual.users} users, ${actual.clients} clients, ${actual.transactions} transactions, ${actual.scores} scores.`);
  } finally {
    await restored.end().catch(() => {});
  }
} catch (error) {
  console.error(`FAIL backup restore check: ${error.code || error.name}: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      await maintenance.query(`DROP DATABASE "${restoreDatabase}"`);
      console.log('PASS temporary restored database removed');
    } catch (error) {
      console.error(`CLEANUP REQUIRED: temporary database ${restoreDatabase}; SQLSTATE=${error.code || 'unknown'}`);
      process.exitCode = 1;
    }
  }
  await maintenance.end().catch(() => {});
}
