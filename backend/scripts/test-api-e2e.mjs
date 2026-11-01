import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as XLSX from 'xlsx';

const { Client } = pg;
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.join(backendDir, 'database');
const qaDatabase = `rfm_e2e_${Date.now()}_${randomBytes(4).toString('hex')}`;
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
};
const admin = new Client({ ...dbConfig, database: process.env.DB_MAINTENANCE_DATABASE || 'postgres' });
let created = false;
let app;
let testCount = 0;

function check(condition, description) {
  assert.ok(condition, description);
  testCount += 1;
  console.log(`PASS ${description}`);
}

async function expectStatus(response, status, description) {
  if (response.status !== status) {
    const body = await response.text();
    throw new Error(`${description}: expected HTTP ${status}, received ${response.status}: ${body.slice(0, 250)}`);
  }
  testCount += 1;
  console.log(`PASS ${description}`);
}

async function readJson(response) {
  return response.json();
}

function authCookie(response) {
  const value = response.headers.get('set-cookie') || '';
  const cookie = value.split(';', 1)[0];
  assert.match(cookie, /^rfm_access_token=/, 'auth cookie should be present');
  return cookie;
}

async function request(baseUrl, route, { cookie, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('Cookie', cookie);
  return fetch(`${baseUrl}${route}`, { ...options, headers });
}

async function prepareDatabase() {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${qaDatabase}"`);
  created = true;
  const db = new Client({ ...dbConfig, database: qaDatabase });
  try {
    await db.connect();
    for (const file of [
      'init.sql',
      'migrations/001_add_ai_interpretation.sql',
      'migrations/002_store_rfm_calculation_rules.sql',
      'migrations/003_reliability_constraints.sql',
      'migrations/004_client_data_ownership.sql',
    ]) {
      await db.query(await readFile(path.join(databaseDir, file), 'utf8'));
      console.log(`PASS isolated DB: ${file}`);
    }
  } finally {
    await db.end();
  }
}

async function main() {
  await access(path.join(backendDir, 'dist', 'app.module.js')).catch(() => {
    throw new Error('Backend is not built; run npm run build before npm run test:e2e.');
  });
  await prepareDatabase();

  process.env.DB_DATABASE = qaDatabase;
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
  const [{ NestFactory }, { ValidationPipe }, { json, urlencoded }, { AppModule }, { ApiExceptionFilter }] = await Promise.all([
    import('@nestjs/core'),
    import('@nestjs/common'),
    import('express'),
    import('../dist/app.module.js'),
    import('../dist/common/filters/api-exception.filter.js'),
  ]);

  app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const email1 = `qa-${randomBytes(5).toString('hex')}@example.invalid`;
  const email2 = `qa-${randomBytes(5).toString('hex')}@example.invalid`;
  const password = `Qa-${randomBytes(12).toString('hex')}!`;

  const health = await request(baseUrl, '/api/health');
  await expectStatus(health, 200, 'health endpoint reports ready API and database');
  check((await readJson(health)).components.database === 'ok', 'health endpoint confirms database connection');

  const anonymousStats = await request(baseUrl, '/api/data/stats');
  await expectStatus(anonymousStats, 401, 'protected data endpoint rejects anonymous request');

  const registration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email1, password, fullName: 'QA User One' }),
  });
  await expectStatus(registration, 201, 'registration creates the first test account');
  const cookie1 = authCookie(registration);
  check((await readJson(registration)).user.email === email1, 'registration returns a public user profile');
  const profile = await request(baseUrl, '/api/auth/profile', { cookie: cookie1 });
  await expectStatus(profile, 200, 'HttpOnly cookie authenticates profile request');

  const form = new FormData();
  form.append('file', new Blob([
    'client_id,transaction_date,amount,full_name\nqa-c1,2026-03-01,12.50,Synthetic Client\nqa-c1,2026-03-02,7.25,Synthetic Client',
  ], { type: 'text/csv' }), 'qa.csv');
  const previewResponse = await request(baseUrl, '/api/data/import/csv/preview', {
    method: 'POST', cookie: cookie1, body: form,
  });
  await expectStatus(previewResponse, 201, 'CSV preview validates a file before saving');
  const preview = await readJson(previewResponse);
  check(preview.clientsInFile === 1 && preview.transactionsInFile === 2 && preview.sampleRows.length === 2,
    'CSV preview returns counts and sample rows');
  const statsBeforeConfirm = await request(baseUrl, '/api/data/stats', { cookie: cookie1 });
  await expectStatus(statsBeforeConfirm, 200, 'statistics are available before confirming import');
  check(Number((await readJson(statsBeforeConfirm)).totalTransactions) === 0,
    'CSV preview does not write transactions before confirmation');
  const imported = await request(baseUrl, '/api/data/import/csv', { method: 'POST', cookie: cookie1, body: form });
  await expectStatus(imported, 201, 'CSV import accepts a valid file');
  check((await readJson(imported)).transactionsImported === 2, 'CSV import stores repeated-client transactions');

  const stats = await request(baseUrl, '/api/data/stats', { cookie: cookie1 });
  await expectStatus(stats, 200, 'authenticated statistics request succeeds');
  const statsData = await readJson(stats);
  check(Number(statsData.totalClients) === 1 && Number(statsData.totalTransactions) === 2, 'statistics reflect imported records');

  const clients = await request(baseUrl, '/api/data/clients?page=1&pageSize=1&search=Synthetic', { cookie: cookie1 });
  await expectStatus(clients, 200, 'client listing supports paging and search');
  const clientPage = await readJson(clients);
  check(clientPage.total === 1 && clientPage.items.length === 1 && clientPage.totalPages === 1, 'client response includes bounded page metadata');

  const badDate = await request(baseUrl, '/api/data/transactions?dateFrom=2026-02-30', { cookie: cookie1 });
  await expectStatus(badDate, 400, 'transaction filter rejects an impossible date');

  const analysisResponse = await request(baseUrl, '/api/rfm/analyze', {
    method: 'POST',
    cookie: cookie1,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-02', quartilesCount: 5 }),
  });
  await expectStatus(analysisResponse, 201, 'RFM analysis runs using imported transactions');
  const analysis = await readJson(analysisResponse);
  check(analysis.clientsAnalyzed === 1 && Boolean(analysis.analysisConfigId), 'RFM analysis returns a persisted result');

  const history = await request(baseUrl, '/api/rfm/analyses?page=1&pageSize=10', { cookie: cookie1 });
  await expectStatus(history, 200, 'analysis history endpoint returns a page');
  check((await readJson(history)).items.length === 1, 'analysis history contains the completed run');

  const secondRegistration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email2, password, fullName: 'QA User Two' }),
  });
  await expectStatus(secondRegistration, 201, 'registration creates an isolated second account');
  const cookie2 = authCookie(secondRegistration);
  const secondImportForm = new FormData();
  secondImportForm.append('file', new Blob([
    'client_id,transaction_date,amount,full_name\nqa-c1,2026-03-03,99.00,Second Account Client',
  ], { type: 'text/csv' }), 'qa-second.csv');
  const secondImport = await request(baseUrl, '/api/data/import/csv', {
    method: 'POST', cookie: cookie2, body: secondImportForm,
  });
  await expectStatus(secondImport, 201, 'second account can import the same external client ID');
  const secondStats = await request(baseUrl, '/api/data/stats', { cookie: cookie2 });
  await expectStatus(secondStats, 200, 'second account statistics request succeeds');
  const secondStatsData = await readJson(secondStats);
  check(Number(secondStatsData.totalClients) === 1 && Number(secondStatsData.totalTransactions) === 1,
    'second account sees only its own client and transaction totals');
  const secondClients = await request(baseUrl, '/api/data/clients?search=qa-c1', { cookie: cookie2 });
  await expectStatus(secondClients, 200, 'second account can search its own client');
  const secondClientPage = await readJson(secondClients);
  check(secondClientPage.total === 1 && secondClientPage.items[0].fullName === 'Second Account Client',
    'same external ID resolves to the second account own client');
  const secondTransactions = await request(baseUrl, '/api/data/transactions?search=Second%20Account%20Client', { cookie: cookie2 });
  await expectStatus(secondTransactions, 200, 'second account can search its own transactions');
  const secondTransactionPage = await readJson(secondTransactions);
  check(secondTransactionPage.total === 1 && Number(secondTransactionPage.items[0].amount) === 99,
    'transaction search returns only the second account record');
  const hiddenFirstTransactions = await request(baseUrl, '/api/data/transactions?search=Synthetic%20Client', { cookie: cookie2 });
  await expectStatus(hiddenFirstTransactions, 200, 'second account transaction search remains scoped');
  check((await readJson(hiddenFirstTransactions)).total === 0,
    'second account cannot find the first account transaction by client name');
  const secondAnalysisResponse = await request(baseUrl, '/api/rfm/analyze', {
    method: 'POST',
    cookie: cookie2,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-03-03', endDate: '2026-03-03', quartilesCount: 5 }),
  });
  await expectStatus(secondAnalysisResponse, 201, 'second account RFM analysis uses its own dataset');
  const secondAnalysis = await readJson(secondAnalysisResponse);
  check(secondAnalysis.clientsAnalyzed === 1 && Number(secondAnalysis.rfmScores[0].monetaryValue) === 99,
    'second account RFM results exclude the first account transactions');
  const secondAnalysisClientsResponse = await request(
    baseUrl,
    `/api/rfm/results/${secondAnalysis.analysisConfigId}/clients?search=qa-c1`,
    { cookie: cookie2 },
  );
  await expectStatus(secondAnalysisClientsResponse, 200, 'second analysis client results are accessible to their owner');
  const secondAnalysisClients = await readJson(secondAnalysisClientsResponse);
  check(secondAnalysisClients.totalClients === 1 && secondAnalysisClients.scores[0].fullName === 'Second Account Client',
    'same external ID in RFM results resolves to the correct owner copy');
  const secondClientDetailResponse = await request(
    baseUrl,
    `/api/rfm/results/${secondAnalysis.analysisConfigId}/clients/${secondClientPage.items[0].id}`,
    { cookie: cookie2 },
  );
  await expectStatus(secondClientDetailResponse, 200, 'second account can open its own client detail');
  const secondClientDetail = await readJson(secondClientDetailResponse);
  check(secondClientDetail.client.fullName === 'Second Account Client' && secondClientDetail.transactionsTotal === 1,
    'client detail and transaction history are scoped to the current account');
  const firstStatsAfterSecondImport = await request(baseUrl, '/api/data/stats', { cookie: cookie1 });
  await expectStatus(firstStatsAfterSecondImport, 200, 'first account statistics remain available');
  const firstStatsData = await readJson(firstStatsAfterSecondImport);
  check(Number(firstStatsData.totalClients) === 1 && Number(firstStatsData.totalTransactions) === 2,
    'second account import does not change first account statistics');
  const foreignResult = await request(baseUrl, `/api/rfm/results/${analysis.analysisConfigId}`, { cookie: cookie2 });
  await expectStatus(foreignResult, 404, 'another account cannot retrieve the first account analysis');
  const secondHistory = await request(baseUrl, '/api/rfm/analyses', { cookie: cookie2 });
  await expectStatus(secondHistory, 200, 'second account can access its own history');
  const secondHistoryData = await readJson(secondHistory);
  check(secondHistoryData.items.length === 1 && secondHistoryData.items[0].id === secondAnalysis.analysisConfigId,
    'second account history contains only its own RFM run');

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['client_id', 'transaction_date', 'amount', 'full_name'],
    ['qa-excel-client', '2026-03-05', 33.5, 'Excel Client'],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const excelForm = new FormData();
  excelForm.append('file', new Blob([new Uint8Array(excelBuffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), 'qa.xlsx');
  const excelPreviewResponse = await request(baseUrl, '/api/data/import/excel/preview', {
    method: 'POST', cookie: cookie1, body: excelForm,
  });
  await expectStatus(excelPreviewResponse, 201, 'Excel preview validates workbook before saving');
  const excelPreview = await readJson(excelPreviewResponse);
  check(excelPreview.clientsInFile === 1 && excelPreview.transactionsInFile === 1,
    'Excel preview returns parsed row counts');
  const excelImportForm = new FormData();
  excelImportForm.append('file', new Blob([new Uint8Array(excelBuffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), 'qa.xlsx');
  const excelImport = await request(baseUrl, '/api/data/import/excel', {
    method: 'POST', cookie: cookie1, body: excelImportForm,
  });
  await expectStatus(excelImport, 201, 'Excel import persists the confirmed workbook');
  check((await readJson(excelImport)).transactionsImported === 1, 'Excel import stores the validated transaction');
  const firstStatsWithExcel = await request(baseUrl, '/api/data/stats', { cookie: cookie1 });
  await expectStatus(firstStatsWithExcel, 200, 'account statistics include confirmed Excel import');
  const firstStatsWithExcelData = await readJson(firstStatsWithExcel);
  check(Number(firstStatsWithExcelData.totalClients) === 2 && Number(firstStatsWithExcelData.totalTransactions) === 3,
    'confirmed Excel import updates only its owning account totals');

  const logout = await request(baseUrl, '/api/auth/logout', { method: 'POST', cookie: cookie1 });
  await expectStatus(logout, 204, 'logout clears the session cookie');
  const clearedCookie = logout.headers.get('set-cookie') || '';
  check(/^rfm_access_token=;/i.test(clearedCookie) && /Max-Age=0|Expires=/i.test(clearedCookie), 'logout expires the browser cookie');
  const loggedOutProfile = await request(baseUrl, '/api/auth/profile');
  await expectStatus(loggedOutProfile, 401, 'cleared session cannot access protected profile');

  console.log(`PASS ${testCount} HTTP integration checks`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL isolated API E2E check: ${error?.message || 'Unknown error'}`);
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
  if (created) {
    try {
      await admin.query(`DROP DATABASE "${qaDatabase}"`);
      console.log('PASS temporary E2E database removed');
    } catch (error) {
      console.error(`CLEANUP REQUIRED: temporary database ${qaDatabase}; drop it manually. SQLSTATE=${error?.code || 'unknown'}`);
      process.exitCode = 1;
    }
  }
  await admin.end().catch(() => {});
}
