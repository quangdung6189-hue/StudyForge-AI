import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { db } from '../packages/db/src/index.ts';
import { documentStorage } from '../apps/web/src/server/document-files.ts';

const base = process.env.APP_URL ?? 'http://localhost:3000', artifacts = path.resolve('.data/document-studio-checks');
const results = [], errors = []; let browser, owner, page;
const pass = name => { results.push(name); console.log(`PASS: ${name}`); };
const source = `I. TRẮC NGHIỆM CHỌN MỘT ĐÁP ÁN
Câu 1. Hai cộng hai bằng bao nhiêu?
A. 3
B. 4 [Đáp án]
II. TRẮC NGHIỆM ĐÚNG/SAI
Câu 1. Dữ kiện: 2 + 2 = 4.
A. Kết quả bằng bốn. ĐÚNG
B. Kết quả bằng năm. SAI
Giải thích ngắn: Gộp hai nhóm có hai phần tử cho tổng bốn phần tử; vì thế kết quả bằng bốn là đúng và kết quả bằng năm là sai.
III. TRẢ LỜI NGẮN
Câu 1. Tính 2 + 2.
Đáp án: 4
IV. Ghép đôi
Câu 1. Ghép các số với tên gọi tương ứng.`;
async function json(url, body) { const response = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: `studyforge_session=${owner.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(180000) }); return { response, data: response.headers.get('Content-Type')?.includes('ndjson') ? await response.text() : await response.json() }; }
async function layout(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const sizing = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, className: String(el.className), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })) }));
  assert(sizing.width <= sizing.viewport + 1, `${name}: ${JSON.stringify(sizing)}`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true }); pass(name);
}
try {
  await mkdir(artifacts, { recursive: true });
  const user = await db.user.create({ data: { email: `document-studio-${randomUUID()}@example.com`, name: 'Document studio check', role: 'teacher' } });
  owner = { id: user.id, token: randomBytes(32).toString('hex') };
  await db.session.create({ data: { userId: owner.id, tokenHash: createHash('sha256').update(owner.token).digest('hex'), expiresAt: new Date(Date.now() + 900000) } });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  await context.addCookies([{ name: 'studyforge_session', value: owner.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && /hydrat|didn't match/i.test(message.text())) errors.push(message.text()); });
  await page.goto(base + '/documents', { waitUntil: 'networkidle' });
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/documents/upload') && response.request().method() === 'POST');
  await page.locator('.u032 input[type=file]').setInputFiles({ name: 'Mixed-format-verification.txt', mimeType: 'text/plain', buffer: Buffer.from(source) });
  const uploadResponse = await uploaded; assert.equal(uploadResponse.status(), 200); const uploadedDoc = (await uploadResponse.json()).documents[0];
  await page.getByRole('heading', { name: 'Mixed-format-verification', exact: true }).waitFor();
  const detail = (await json(`/api/documents/${uploadedDoc.id}`)).data;
  assert.deepEqual(detail.analysis.counts, { single: 1, multiple: 0, boolean: 2, short: 1, fill: 0 }); assert.equal(detail.analysis.unsupported.length, 1);
  assert.equal(detail.analysis.questions.filter(q => q.documentAnswer).length, 4);
  pass('Actual TXT upload, saved structure, four source answers and unsupported-format warning');
  const original = await context.request.get(`${base}/api/documents/${uploadedDoc.id}/file`); assert.equal(original.status(),200); assert.equal(await original.text(), source); assert.equal(original.headers()['x-frame-options'],'SAMEORIGIN');
  const guest = await browser.newContext(); assert.equal((await guest.request.get(`${base}/api/documents/${uploadedDoc.id}/file`)).status(),401); await guest.close();
  pass('Original file is readable only with authenticated ownership');
  await page.getByLabel('Dạng câu', { exact: true }).selectOption('boolean'); assert.equal(await page.locator('.documents-question').count(),2);
  await page.getByLabel('Dạng câu', { exact: true }).selectOption('unsupported'); assert.equal(await page.locator('.documents-question').count(),1);
  await page.getByLabel('Dạng câu', { exact: true }).selectOption('all');
  await layout('desktop-reader-light');
  await page.getByRole('tab', { name: 'Văn bản', exact: true }).click();
  await page.getByLabel('Văn bản theo thứ tự trang', { exact: true }).fill(source + '\nV. Điền từ\nCâu 1. Hai cộng __ bằng bốn.\nĐáp án: hai');
  assert(await page.getByRole('button', { name: 'Đọc lại file gốc', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'Lưu & phân loại lại', exact: true }).click();
  await page.getByText('Đã lưu và phân loại lại câu hỏi từ văn bản mới.', { exact: true }).waitFor();
  const afterSave = (await json(`/api/documents/${uploadedDoc.id}`)).data; assert.equal(afterSave.analysis.counts.fill,1);
  const conflict = await context.request.patch(`${base}/api/documents/${uploadedDoc.id}`, { data: { rawText: 'This stale write must fail.', revision: detail.revision } }); assert.equal(conflict.status(),409);
  pass('Manual edits reclassify questions and stale revisions cannot overwrite newer text');
  await page.getByRole('button', { name: 'Đọc lại file gốc', exact: true }).click();
  await page.getByText('Đã đọc lại và phân loại lại tài liệu.', { exact: false }).waitFor();
  const afterRead = (await json(`/api/documents/${uploadedDoc.id}`)).data; assert.equal(afterRead.rawText,source); assert.equal(afterRead.analysis.counts.fill,0);
  pass('Re-reading the original file restores source text through the real backend');
  const zip = new JSZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const p = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const numbered = (level,text) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const row = cells => `<w:tr>${cells.map(text=>`<w:tc>${p(text)}</w:tc>`).join('')}</w:tr>`;
  zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('I. Trắc nghiệm')}${numbered(0,'Tính 2 + 2.')}${numbered(1,'3')}${numbered(1,'4 [Đáp án]')}<w:tbl>${row(['Câu','1'])}${row(['Đáp án','B'])}</w:tbl></w:body></w:document>`);
  zip.file('word/numbering.xml','<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%2."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>');
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>');
  const docxResponse = await context.request.post(`${base}/api/documents/upload`,{multipart:{files:{name:'Numbered-table.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})}}});
  assert.equal(docxResponse.status(),200); const docx = (await docxResponse.json()).documents[0]; const docxDetail = (await json(`/api/documents/${docx.id}`)).data;
  assert.equal(docxDetail.analysis.counts.single,1); assert.deepEqual(docxDetail.analysis.questions[0].options,['3','4']); assert.deepEqual(docxDetail.analysis.questions[0].documentAnswer.indices,[1]);
  pass('Real DOCX automatic numbering, nested options and answer table preserve structure');
  await page.getByRole('tab', { name: 'Câu hỏi', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Văn bản', exact: true }).getAttribute('aria-selected'),'true');
  await page.getByRole('tab', { name: 'Câu hỏi', exact: true }).click();
  await page.setViewportSize({ width:375,height:812 }); await layout('mobile-reader-light');
  await page.emulateMedia({ reducedMotion:'reduce' }); await page.getByRole('button',{name:'Chuyển sang giao diện tối',exact:true}).click(); await layout('mobile-reader-dark-reduced-motion');
  pass('Lucian reader tabs support keyboard and reduced motion');
  const body = { documentId: uploadedDoc.id, mode:'extract_existing',questionCount:4,types:['single','boolean','short'] };
  const started = Date.now(), first = await json('/api/quizzes/generate?stream=1',body); assert.equal(first.response.status,200);
  const events = first.data.trim().split('\n').map(line=>JSON.parse(line)); const result = events.find(event=>event.event==='result'); assert(result,JSON.stringify(events.at(-1)));
  assert.equal(result.questions.length,4); assert(events.some(event=>event.event==='progress'&&event.completed>0));
  pass(`Real Flash High stream generated four questions in ${Math.round((Date.now()-started)/1000)}s`);
  const repeated = await json('/api/quizzes/generate?stream=1',body); const reused = repeated.data.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(reused.filter(event=>event.event==='progress').at(-1).cached,4);
  assert.notEqual(reused.find(event=>event.event==='result').questions[0].id,result.questions[0].id);
  pass('Retry reuses completed batches and gives independent question IDs');
  await page.goto(`${base}/quizzes/create?docId=${uploadedDoc.id}`,{waitUntil:'networkidle'}); await page.getByRole('button',{name:'Tiếp tục →',exact:true}).click();
  await page.getByRole('radio',{name:/Trích xuất đề có sẵn/}).click(); await page.getByLabel('Số câu tối đa cần lấy',{exact:true}).fill('4');
  await page.getByRole('button',{name:'✦ Tạo đề nháp',exact:true}).click(); await page.getByRole('heading',{name:'Kiểm tra trước khi xuất bản',exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('.studio-question').count(),4); await layout('mobile-real-generated-review');
  pass('Actual builder consumes the progress stream and displays all source formats');
  assert.equal(errors.length,0,errors.join('\n')); pass('No runtime or hydration errors');
} catch(error) { console.error(error.stack); process.exitCode=1; if(page) await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{}); }
finally {
  if(browser) await browser.close();
  if(owner) { const docs=await db.document.findMany({where:{ownerId:owner.id}}); for(const doc of docs) { await documentStorage().remove({id:owner.id},doc.storageKey).catch(()=>{}); await unlink(path.join(process.env.STUDYFORGE_ROOT??process.cwd(),'.data/document-extraction',`${doc.id}.json`)).catch(()=>{}); } await db.document.deleteMany({where:{ownerId:owner.id}}); await db.user.delete({where:{id:owner.id}}); }
  await db.$disconnect(); await writeFile(path.join(artifacts,'results.json'),JSON.stringify({passed:results.length,checks:results,errors,realProvider:true},null,2));
}
