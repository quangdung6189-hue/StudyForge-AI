import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Use only a separately launched local fixture server, never a production account/DB.
const base = process.env.UPLOAD_TEST_URL;
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Set UPLOAD_TEST_URL to an isolated local test server.');
const artifacts = path.resolve('.data/upload-browser-checks');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], passed = [], uploads = [], requestSizes = [], acknowledgements = [], received = new Map();
const pass = name => { passed.push(name); console.log(`PASS: ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const registered = await context.request.post(`${base}/api/auth/register`, { data: { email: `upload-${randomUUID()}@example.com`, name: 'Upload Browser Check', password: 'UploadSecurePass123!', role: 'teacher' } });
  assert.equal(registered.status(), 200, await registered.text());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/documents/uploads/') && response.request().method() === 'PUT' && response.ok()) {
      acknowledgements.push(response.json().then(data => {
        const previous = received.get(response.url()) ?? 0;
        requestSizes.push(data.receivedBytes - previous); received.set(response.url(), data.receivedBytes);
      }));
    }
  });
  await page.goto(`${base}/documents`, { waitUntil: 'networkidle' });
  const source = 'I. TRẮC NGHIỆM\nCâu 1. Hai cộng hai bằng bao nhiêu?\nA. Ba\nB. Bốn [Đáp án]';
  const complete = page.waitForResponse(response => /\/api\/documents\/uploads\/[^/]+\/complete$/.test(response.url()) && response.request().method() === 'POST');
  await page.locator('.u032 input[type=file]').setInputFiles({ name: 'Tài liệu upload thật.txt', mimeType: 'text/plain', buffer: Buffer.from(source) });
  const response = await complete; assert.equal(response.status(), 200, await response.text());
  const doc = (await response.json()).documents[0]; uploads.push(doc.id);
  await page.getByRole('heading', { name: 'Tài liệu upload thật', exact: true }).waitFor();
  assert(await page.locator('.u032-row.done').count());
  const original = await context.request.get(`${base}/api/documents/${doc.id}/file`);
  assert.equal(original.status(), 200); assert.equal(await original.text(), source);
  pass('Real browser chunked upload, native text parsing, private DB original and UI success');
  const detail = await context.request.get(`${base}/api/documents/${doc.id}`);
  assert.equal((await detail.json()).extraction.method, 'native');
  const guest = await browser.newContext();
  assert.equal((await guest.request.get(`${base}/api/documents/${doc.id}/file`)).status(), 401);
  await guest.close(); pass('Unauthenticated original access stays blocked');
  for (const [name, width, theme, motion] of [['desktop-light', 1440, 'light', 'no-preference'], ['mobile-light', 375, 'light', 'no-preference'], ['mobile-dark-reduced', 375, 'dark', 'reduce']]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: motion });
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.getByRole('button', { name: /Kéo thả tài liệu/ }).focus();
    await page.waitForTimeout(100);
    const sizing = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert(sizing.actual <= sizing.viewport + 1, JSON.stringify(sizing));
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true }); pass(name);
  }
  // >4.5 MB DOCX, stored uncompressed in ZIP, remains a small native text document.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Large original upload through small private parts.</w:t></w:r></w:p></w:body></w:document>');
  zip.file('word/private-padding.bin', Buffer.alloc(5 * 1024 * 1024, 0x31));
  const large = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  const completed = page.waitForResponse(result => /\/api\/documents\/uploads\/[^/]+\/complete$/.test(result.url()) && result.request().method() === 'POST');
  await page.locator('.u032 input[type=file]').setInputFiles({ name: 'Large-private.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: large });
  const largeResponse = await completed; assert.equal(largeResponse.status(), 200, await largeResponse.text());
  const largeDoc = (await largeResponse.json()).documents[0]; uploads.push(largeDoc.id);
  const downloaded = await context.request.get(`${base}/api/documents/${largeDoc.id}/file`);
  assert.deepEqual(await downloaded.body(), large);
  await Promise.all(acknowledgements);
  assert(requestSizes.length >= 7); assert(requestSizes.every(size => size > 0 && size <= 1024 * 1024), JSON.stringify(requestSizes));
  pass('File above 5 MB uploads in 1MB parts and downloads byte-for-byte');
  const pdfText = 'StudyForge PDF native text from a private database original. This line has enough study material for native reading.';
  const stream = `BT /F1 12 Tf 20 100 Td (${pdfText}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const pdfCompleted = page.waitForResponse(result => /\/api\/documents\/uploads\/[^/]+\/complete$/.test(result.url()) && result.request().method() === 'POST');
  await page.locator('.u032 input[type=file]').setInputFiles({ name: 'Native-private.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
  const pdfResponse = await pdfCompleted; assert.equal(pdfResponse.status(), 200, await pdfResponse.text());
  const pdfDoc = (await pdfResponse.json()).documents[0]; uploads.push(pdfDoc.id);
  const pdfDetail = await context.request.get(`${base}/api/documents/${pdfDoc.id}`);
  assert((await pdfDetail.json()).rawText.includes('StudyForge PDF native text'));
  pass('Native PDF worker and text parsing work in the compiled production server');
  assert.equal(errors.length, 0, errors.join('\n')); pass('No browser runtime errors');
} finally {
  await browser.close();
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ passed, errors, uploads, requestSizes }, null, 2));
}