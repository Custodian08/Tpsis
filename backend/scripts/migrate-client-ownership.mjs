import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createDatabaseBackup } from './backup-database.mjs';

const { Client } = pg;
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(backendDir, 'database', 'migrations', '004_client_data_ownership.sql');
const db = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'rfm_analysis',
  connectionTimeoutMillis: 5000,
});

let connected = false;
try {
  await db.connect();
  connected = true;
  const current = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM clients) AS clients,
      (SELECT COUNT(*)::int FROM transactions) AS transactions,
      (SELECT COUNT(*)::int FROM rfm_scores) AS scores,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'clients' AND column_name = 'owner_user_id'
      ) AS ownership_migration_present
  `);
  const before = current.rows[0];
  if (before.clients > 0 && before.users === 0) {
    throw new Error('В базе есть клиенты, но нет аккаунтов; сначала создайте аккаунт, чтобы назначить владельцев.');
  }

  console.log(`Database preflight: ${before.users} accounts, ${before.clients} clients, ${before.transactions} transactions, ${before.scores} scores.`);
  const backup = await createDatabaseBackup();
  console.log(`PASS backup created (${backup.sizeBytes} bytes): ${backup.path}`);

  const migrationSql = await readFile(migrationPath, 'utf8');
  await db.query(migrationSql);

  const validation = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM clients WHERE owner_user_id IS NULL) AS unowned_clients,
      (SELECT COUNT(*)::int FROM rfm_scores score
       JOIN analysis_configs config ON config.id = score.analysis_config_id
       JOIN clients client ON client.id = score.client_id
       WHERE client.owner_user_id IS DISTINCT FROM config.user_id) AS scores_with_wrong_owner,
      (SELECT COUNT(*)::int FROM clients) AS clients_after,
      (SELECT COUNT(*)::int FROM transactions) AS transactions_after,
      (SELECT COUNT(*)::int FROM rfm_scores) AS scores_after
  `);
  const after = validation.rows[0];
  if (after.unowned_clients !== 0 || after.scores_with_wrong_owner !== 0 || after.scores_after !== before.scores) {
    throw new Error('Проверка целостности после миграции не пройдена; сохраните backup и проверьте БД до запуска приложения.');
  }

  console.log(`PASS migration 004 applied; ${before.clients} clients → ${after.clients_after}, ${before.transactions} transactions → ${after.transactions_after}, ${after.scores_after} analysis scores preserved.`);
  console.log('PASS every client has an owner and every analysis score belongs to that analysis owner.');
} catch (error) {
  console.error(`FAIL ownership migration: ${error.code || error.name}: ${error.message}`);
  if (connected) await db.query('ROLLBACK').catch(() => {});
  process.exitCode = 1;
} finally {
  if (connected) await db.end().catch(() => {});
}
