import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { db, runtimeDatabaseUrl, readWithRetry } from '../packages/db/src/index.ts';

const baseURL = process.env.APP_URL ?? 'http://localhost:3000';
let userId, browser, page;
const result = { success: false, checks: [] };
try {
  const url = new URL(runtimeDatabaseUrl(process.env.DATABASE_URL));
  result.database = { pooled: url.hostname.includes('-pooler.'), connectTimeout: url.searchParams.get('connect_timeout'), poolTimeout: url.searchParams.get('pool_timeout'), connectionLimit: url.searchParams.get('connection_limit') };
  console.log(JSON.stringify({ stage: 'connecting', database: result.database }));
  await readWithRetry(() => db.$queryRaw`SELECT 1`);
  result.checks.push('Live PostgreSQL connection');
  console.log('PASS: Live PostgreSQL connection');
  const user = await db.user.create({ data: { email: `database-check-${randomUUID()}@example.com`, name: 'Database recovery verification', role: 'teacher' } }); userId = user.id;
  const doc = await db.document.create({ data: { ownerId: userId, title: 'Database recovery check', fileType: 'text/plain', size: 30, storageKey: `database-check/${randomUUID()}`, status: 'ready', rawText: 'Đây là tài liệu để kiểm tra kết nối.', chunks: { create: { chunkIndex: 0, content: 'Đây là tài liệu để kiểm tra kết nối.' } } } });
  const token = randomBytes(32).toString('hex');
  await db.session.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 600_000) } });
  async function checkList() {
    const response = await fetch(`${baseURL}/api/documents?limit=100`, { headers: { Cookie: `studyforge_session=${token}` }, signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.total, 1); assert.equal(data.items[0].id, doc.id);
  }
  await checkList(); await checkList();
  await Promise.all(Array.from({ length: 4 }, checkList));
  result.checks.push('Six authenticated document-list requests, including four concurrent requests');
  console.log('PASS: Six live document-list requests');
  // Close only this test process's client. The app's shared pool remains untouched.
  await db.$disconnect();
  await readWithRetry(() => db.$queryRaw`SELECT 1`);
  result.checks.push('Own database client reconnects after disconnect');
  console.log('PASS: Reconnection after closing the test client');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: 'studyforge_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // React development StrictMode may abort and repeat the initial fetch. Keep the outage
  // active until the retry control appears, then restore the real endpoint.
  await page.route('**/api/documents?limit=100', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Kết nối dữ liệu đang gián đoạn. Vui lòng thử lại sau vài giây.' } }) }));
  await page.goto(`${baseURL}/quizzes/create`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Thử tải lại tài liệu', exact: true }).waitFor();
  assert.equal(await page.getByText('Thư viện của bạn chưa có tài liệu', { exact: true }).count(), 0);
  await page.unroute('**/api/documents?limit=100');
  await page.getByRole('button', { name: 'Thử tải lại tài liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục →', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.u042-next')?.disabled);
  assert.equal(await page.locator('.studio-error[role="alert"]').count(), 0);
  assert.equal(await page.locator('#source-document').inputValue(), doc.id);
  assert.equal(errors.length, 0);
  result.checks.push('Simulated transient 503 shows retry; retry loads the real document list without runtime errors');
  result.success = true;
  console.log(JSON.stringify(result));
} catch (error) {
  if (page) { await page.screenshot({ path: '.data/database-recovery-failure.png', fullPage: true }).catch(() => {}); console.log(JSON.stringify({ path: new URL(page.url()).pathname, alerts: await page.getByRole('alert').allTextContents().catch(() => []) })); }
  console.log(JSON.stringify({ success: false, code: error.code ?? 'CHECK_FAILED', message: error.code ? 'Database verification failed' : error.message })); process.exitCode = 1;
}
finally {
  if (browser) await browser.close();
  if (userId) { await db.document.deleteMany({ where: { ownerId: userId } }); await db.user.delete({ where: { id: userId } }); }
  await db.$disconnect();
  await mkdir('.data', { recursive: true }); await writeFile('.data/database-recovery-check.json', JSON.stringify(result, null, 2));
}
