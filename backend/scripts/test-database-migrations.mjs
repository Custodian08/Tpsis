import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.join(backendDir, 'database');
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
};
const adminDatabase = process.env.DB_MAINTENANCE_DATABASE || 'postgres';
const qaDatabase = `rfm_qa_${Date.now()}_${randomBytes(4).toString('hex')}`;
const admin = new Client({ ...config, database: adminDatabase });
let databaseCreated = false;

function assertDatabaseError(callback, expectedCode, description) {
  return callback().then(
    () => { throw new Error(`${description}: the database accepted an invalid row`); },
    error => {
      if (error.code !== expectedCode) {
        throw new Error(`${description}: expected SQLSTATE ${expectedCode}, received ${error.code || error.name}`);
      }
    },
  );
}

async function main() {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${qaDatabase}"`);
  databaseCreated = true;
  const db = new Client({ ...config, database: qaDatabase });

  try {
    await db.connect();
    for (const file of [
      'init.sql',
      'migrations/001_add_ai_interpretation.sql',
      'migrations/002_store_rfm_calculation_rules.sql',
      'migrations/003_reliability_constraints.sql',
      'migrations/003_reliability_constraints.sql',
    ]) {
      await db.query(await readFile(path.join(databaseDir, file), 'utf8'));
      console.log(`PASS ${file}`);
    }

    const user = await db.query(
      "INSERT INTO users (email, password, full_name) VALUES ('qa@example.invalid', 'test-hash', 'QA User') RETURNING id",
    );
    const client = await db.query(
      "INSERT INTO clients (client_external_id, full_name) VALUES ('qa-client-1', 'Synthetic Client') RETURNING id",
    );
    await db.query(
      "INSERT INTO transactions (client_id, transaction_date, amount, items_count) VALUES ($1, '2026-01-01', 10.00, 1)",
      [client.rows[0].id],
    );
    const configRow = await db.query(
      `INSERT INTO analysis_configs (user_id, config_name, analysis_period, period_start, period_end, reference_date, quartiles_count)
       VALUES ($1, 'QA analysis', 1, '2026-01-01', '2026-01-01', '2026-01-01', 5) RETURNING id`,
      [user.rows[0].id],
    );
    const scoreValues = [client.rows[0].id, configRow.rows[0].id];
    await db.query(
      `INSERT INTO rfm_scores (client_id, analysis_config_id, recency_days, frequency_count, monetary_value, r_score, f_score, m_score, rfm_segment)
       VALUES ($1, $2, 0, 1, 10.00, 5, 5, 5, '555')`,
      scoreValues,
    );
    await db.query(await readFile(path.join(databaseDir, 'migrations/004_client_data_ownership.sql'), 'utf8'));
    console.log('PASS migrations/004_client_data_ownership.sql');
    const assignedOwner = await db.query('SELECT owner_user_id FROM clients WHERE id = $1', [client.rows[0].id]);
    if (Number(assignedOwner.rows[0].owner_user_id) !== Number(user.rows[0].id)) {
      throw new Error('ownership migration did not assign legacy data on a single-user database');
    }
    console.log('PASS single-account legacy data receives its owner');
    const singleTransactionCount = await db.query(
      'SELECT COUNT(*)::int AS n FROM transactions WHERE client_id = $1', [client.rows[0].id],
    );
    if (singleTransactionCount.rows[0].n !== 1) throw new Error('single-account migration changed transaction rows');

    const secondUser = await db.query(
      "INSERT INTO users (email, password, full_name) VALUES ('qa2@example.invalid', 'test-hash', 'QA User Two') RETURNING id",
    );
    const legacyClient = await db.query(
      "INSERT INTO clients (client_external_id, full_name) VALUES ('legacy-multi', 'Legacy Shared Client') RETURNING id",
    );
    await db.query(
      "INSERT INTO transactions (client_id, transaction_date, amount, items_count) VALUES ($1, '2026-02-01', 15.00, 2)",
      [legacyClient.rows[0].id],
    );
    const secondConfig = await db.query(
      `INSERT INTO analysis_configs (user_id, config_name, analysis_period, period_start, period_end, reference_date, quartiles_count)
       VALUES ($1, 'QA second analysis', 1, '2026-02-01', '2026-02-01', '2026-02-01', 5) RETURNING id`,
      [secondUser.rows[0].id],
    );
    await db.query(
      `INSERT INTO rfm_scores (client_id, analysis_config_id, recency_days, frequency_count, monetary_value, r_score, f_score, m_score, rfm_segment)
       VALUES ($1, $2, 0, 1, 15.00, 5, 5, 5, '555')`,
      [legacyClient.rows[0].id, secondConfig.rows[0].id],
    );
    await db.query(await readFile(path.join(databaseDir, 'migrations/004_client_data_ownership.sql'), 'utf8'));
    const copies = await db.query(
      'SELECT id, owner_user_id FROM clients WHERE client_external_id = $1 ORDER BY owner_user_id', ['legacy-multi'],
    );
    if (copies.rowCount !== 2 || new Set(copies.rows.map(row => Number(row.owner_user_id))).size !== 2) {
      throw new Error('multi-account migration did not copy the legacy client to each account');
    }
    const copyTransactions = await db.query(
      `SELECT COUNT(*)::int AS n FROM transactions transaction
       JOIN clients client ON client.id = transaction.client_id
       WHERE client.client_external_id = 'legacy-multi'`,
    );
    if (copyTransactions.rows[0].n !== 2) throw new Error('migration did not copy legacy transactions per account');
    const reboundScore = await db.query(
      `SELECT client.owner_user_id FROM rfm_scores score
       JOIN clients client ON client.id = score.client_id WHERE score.analysis_config_id = $1`,
      [secondConfig.rows[0].id],
    );
    if (Number(reboundScore.rows[0].owner_user_id) !== Number(secondUser.rows[0].id)) {
      throw new Error('historical analysis score was not rebound to its account copy');
    }
    await db.query(await readFile(path.join(databaseDir, 'migrations/004_client_data_ownership.sql'), 'utf8'));
    const copiesAfterRerun = await db.query(
      "SELECT COUNT(*)::int AS n FROM clients WHERE client_external_id = 'legacy-multi'",
    );
    if (copiesAfterRerun.rows[0].n !== 2) throw new Error('migration rerun created duplicate legacy copies');
    console.log('PASS multi-account migration copies clients, transactions, and preserves analysis ownership');
    console.log('PASS migration 004 rerun is idempotent');
    await assertDatabaseError(
      () => db.query(
        "INSERT INTO clients (client_external_id, owner_user_id, full_name) VALUES ('legacy-multi', $1, 'Duplicate')",
        [secondUser.rows[0].id],
      ),
      '23505',
      'same external client ID is unique within an account',
    );
    console.log('PASS external client ID can repeat across accounts only');

    await assertDatabaseError(
      () => db.query("INSERT INTO transactions (client_id, transaction_date, amount, items_count) VALUES ($1, '2026-01-01', 10.00, 0)", [client.rows[0].id]),
      '23514',
      'positive transaction item count',
    );
    await assertDatabaseError(
      () => db.query(
        `INSERT INTO rfm_scores (client_id, analysis_config_id, recency_days, frequency_count, monetary_value, r_score, f_score, m_score, rfm_segment)
         VALUES ($1, $2, 0, 1, 10.00, 5, 5, 5, '555')`,
        scoreValues,
      ),
      '23505',
      'one client score per analysis',
    );
    await assertDatabaseError(
      () => db.query(
        `INSERT INTO rfm_scores (client_id, analysis_config_id, recency_days, frequency_count, monetary_value, r_score, f_score, m_score, rfm_segment)
         VALUES ($1, $2, 0, 1, 10.00, 5, 5, 5, '555')`,
        [client.rows[0].id, configRow.rows[0].id + 10000],
      ),
      '23503',
      'RFM score foreign key enforcement',
    );
    console.log('PASS migration constraints reject invalid rows');
  } finally {
    await db.end();
  }
}

try {
  await main();
} catch (error) {
  const code = error?.code ? ` SQLSTATE=${error.code}` : '';
  console.error(`FAIL isolated migration check.${code} ${error?.message || 'Unknown error'}`);
  process.exitCode = 1;
} finally {
  if (databaseCreated) {
    try {
      await admin.query(`DROP DATABASE "${qaDatabase}"`);
      console.log('PASS temporary QA database removed');
    } catch (error) {
      console.error(`CLEANUP REQUIRED: temporary database ${qaDatabase}; drop it manually. SQLSTATE=${error?.code || 'unknown'}`);
      process.exitCode = 1;
    }
  }
  await admin.end().catch(() => {});
}
