import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdir, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupDir = path.join(backendDir, '.local-backups');

async function findPgDump() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
  if (process.platform !== 'win32') return 'pg_dump';

  const candidates = [18, 17, 16, 15, 14, 13, 12].map(version =>
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL', String(version), 'bin', 'pg_dump.exe'),
  );
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed PostgreSQL client version.
    }
  }
  throw new Error('pg_dump не найден. Установите PostgreSQL client tools или задайте PG_DUMP_PATH.');
}

export async function createDatabaseBackup() {
  const password = process.env.DB_PASSWORD;
  if (!password) throw new Error('В локальном backend/.env не задан DB_PASSWORD; резервная копия не создана.');

  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const suffix = randomBytes(3).toString('hex');
  const destination = path.join(backupDir, `rfm_analysis_${timestamp}_${suffix}.dump`);
  const pgDump = await findPgDump();
  const args = [
    '--format=custom', '--no-owner', '--no-acl', '--no-password',
    '--host', process.env.DB_HOST || 'localhost',
    '--port', String(process.env.DB_PORT || 5432),
    '--username', process.env.DB_USERNAME || 'postgres',
    '--dbname', process.env.DB_DATABASE || 'rfm_analysis',
    '--file', destination,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(pgDump, args, {
      cwd: backendDir,
      env: { ...process.env, PGPASSWORD: password },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump завершился с кодом ${code}: ${stderr.trim() || 'ошибка резервного копирования'}`));
    });
  });

  const backupStats = await stat(destination);
  if (backupStats.size === 0) throw new Error('pg_dump создал пустой файл; миграция не запускалась.');
  return { path: destination, sizeBytes: backupStats.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const backup = await createDatabaseBackup();
    console.log(`PASS database backup created (${backup.sizeBytes} bytes): ${backup.path}`);
  } catch (error) {
    console.error(`FAIL database backup: ${error.message}`);
    process.exitCode = 1;
  }
}
