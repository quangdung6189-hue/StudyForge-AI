import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { db } from '../packages/db/src/index.ts';
import { extractDocumentContent } from '../apps/web/src/server/extractor.ts';
import { detectSourceQuestions } from '../apps/web/src/server/question-sections.ts';

const baseURL = process.env.APP_URL ?? 'http://localhost:3000';
const artifacts = path.resolve('.data/browser-quiz-checks');
const results = [], errors = [];
let browser, userId;
const pass = name => { results.push(name); console.log(`PASS: ${name}`); };
const source = `Kiến thức: 2 + 2 = 4. Số 4 là số chẵn.
PHẦN I. Trắc nghiệm
Câu 1. Tính hai cộng hai.
A. 3   B. 4   C. 5   D. 6
PHẦN II. Đúng sai
Câu 1. Với 2 + 2 = 4:
a) Kết quả là số chẵn.
b) Kết quả bằng 5.
PHẦN III. Trả lời ngắn
Câu 1. Tính 2 + 2.`;
function questions(chunkId) {
  return ['single', 'boolean', 'short'].map((type, index) => {
    const options = (type === 'short' ? [] : type === 'boolean' ? ['Đúng', 'Sai'] : ['3', '4', '5', '6']).map(text => ({ id: randomUUID(), text }));
    return { id: randomUUID(), type, stem: ['Tính hai cộng hai.', 'Kết quả 2 + 2 là số chẵn. Đúng hay sai?', 'Tính 2 + 2.'][index], options,
      correctOptionIds: type === 'short' ? [] : [options[type === 'single' ? 1 : 0].id], acceptedAnswers: type === 'short' ? ['4'] : [],
      explanation: 'Kết luận: Kết quả bằng 4.\n\nBước 1: Gộp hai nhóm có hai đơn vị thành một nhóm.\n\nBước 2: Đếm tổng được bốn đơn vị, nên 2 + 2 = 4.\n\nLưu ý: Không ghép hai chữ số thành 22.',
      sourceRefs: [{ chunkId, quote: '2 + 2 = 4' }], answerOrigin: 'ai_suggested', reviewed: false, difficulty: 'recognition', points: 1, topic: 'Số học' };
  });
}
async function geometry(page, name) {
  await page.locator('.studio-input').first().waitFor();
  await page.locator('.u042-pane').evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: overflow`);
  assert(await page.locator('.quiz-studio input, .quiz-studio select, .quiz-studio button').evaluateAll(nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return !box.width || box.left >= 0 && box.right <= innerWidth + 1; })), `${name}: clipped controls`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  pass(name);
}
try {
  await mkdir(artifacts, { recursive: true });
  const user = await db.user.create({ data: { email: `quiz-browser-${randomBytes(8).toString('hex')}@example.com`, name: 'Quiz browser verification', role: 'teacher' } });
  userId = user.id;
  const doc = await db.document.create({ data: { ownerId: userId, title: 'Đề kiểm tra ba phần', fileType: 'text/plain', size: Buffer.byteLength(source), storageKey: `browser-test/${randomUUID()}`, rawText: source, status: 'ready', chunks: { create: { chunkIndex: 0, content: source } } }, include: { chunks: true } });
  const token = randomBytes(32).toString('hex');
  await db.session.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 600_000) } });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await context.addCookies([{ name: 'studyforge_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const pdfPage = await context.newPage();
  await pdfPage.setContent(`<html lang="vi"><meta charset="utf-8"><body><pre style="white-space:pre-wrap;font-family:Arial">${source}</pre></body></html>`);
  const pdf = await pdfPage.pdf();
  await pdfPage.close();
  const parsedPdf = await extractDocumentContent(pdf, 'application/pdf', 'mixed-exam.pdf');
  assert(parsedPdf.rawText.includes('Trả lời ngắn'));
  assert.deepEqual(detectSourceQuestions(parsedPdf.rawText).map(q => q.type), ['single', 'boolean', 'boolean', 'short']);
  pass('real Vietnamese PDF extraction preserves all three question sections');
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|didn't match|server rendered/i.test(message.text())) errors.push(message.text()); });
  // Session cookie name is intentionally checked against the actual API, not assumed.
  const me = await context.request.get(`${baseURL}/api/auth/me`);
  assert.equal((await me.json()).authenticated, true, 'test session must authenticate');
  const analysis = await context.request.get(`${baseURL}/api/documents/${doc.id}/analysis`);
  assert.deepEqual((await analysis.json()).counts, { single: 1, multiple: 0, boolean: 2, short: 1, fill: 0 });
  pass('authenticated structure analysis counts all three sections');
  const guest = await browser.newContext();
  assert.equal((await guest.request.get(`${baseURL}/api/documents/${doc.id}/analysis`)).status(), 401);
  await guest.close();
  pass('structure analysis blocks guests');
  await page.goto(`${baseURL}/quizzes/create?docId=${doc.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tiếp tục →', exact: true }).click();
  await geometry(page, 'desktop-light-config');
  await page.getByRole('radio', { name: /AI tạo câu mới/ }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('radio', { name: /Trích xuất đề/ }).getAttribute('aria-checked'), 'true');
  pass('Lucian radio cards support arrow keys');
  const toggle = page.getByRole('button', { name: 'Chuyển sang giao diện tối', exact: true });
  await toggle.click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && !document.documentElement.classList.contains('u219-transition'));
  await geometry(page, 'desktop-dark-config');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  pass('theme persists across SSR reload without hydration mismatch');
  await page.getByRole('button', { name: 'Tiếp tục →', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await geometry(page, 'mobile-dark-config');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Chuyển sang giao diện sáng', exact: true }).click();
  await geometry(page, 'mobile-light-reduced-motion-config');
  pass('theme works with reduced motion');
  const invalid = await context.request.post(`${baseURL}/api/quizzes/generate`, { data: { documentId: doc.id, mode: 'ai_generate', questionCount: 0, types: [] } });
  assert.equal(invalid.status(), 400);
  pass('generation API rejects invalid counts and empty types');
  // Verify the real failure path before supplying a browser-only provider fixture for review UI.
  if (!process.env.AI_API_KEY) {
    await page.getByRole('button', { name: '✦ Tạo đề nháp', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Chưa cấu hình' }).waitFor();
    assert(await page.getByRole('heading', { name: 'Thiết kế bài kiểm tra của bạn' }).isVisible());
    pass('unconfigured real AI reports failure and never creates sample questions');
  }
  const fixture = questions(doc.chunks[0].id);
  await page.route('**/api/quizzes/generate*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: fixture, warnings: [] }) }));
  await page.getByRole('button', { name: /Tạo đề nháp|Thử tạo lại/ }).click();
  await page.getByRole('heading', { name: 'Kiểm tra trước khi xuất bản' }).waitFor();
  assert.equal(await page.locator('.studio-question').count(), 3);
  assert(await page.getByText('Đáp án chấp nhận:', { exact: false }).isVisible());
  await page.screenshot({ path: path.join(artifacts, 'mobile-review.png'), fullPage: true });
  pass('browser provider fixture: all three formats and detailed solutions render');
  await page.getByRole('button', { name: 'Trả lời ngắn (1)', exact: true }).click();
  assert.equal(await page.locator('.studio-question').count(), 1);
  await page.getByRole('button', { name: 'Tất cả (3)', exact: true }).click();
  pass('review type filters show actual counts');
  assert(await page.getByRole('button', { name: 'Lưu & xuất bản →', exact: true }).isDisabled());
  const save = await context.request.post(`${baseURL}/api/quizzes`, { data: { documentId: doc.id, title: 'Backend review guard', durationMinutes: 15, questions: fixture } });
  assert.equal(save.status(), 201);
  const saved = (await save.json()).quiz;
  const unreviewedPublish = await context.request.post(`${baseURL}/api/quizzes/${saved.id}/publish`, { data: { allowReview: true } });
  assert.equal(unreviewedPublish.status(), 409);
  pass('real database saves draft and backend rejects unreviewed publication');
  const banksAfterSave = await db.questionBank.count({ where: { ownerId: userId } });
  const duplicate = await context.request.post(`${baseURL}/api/quizzes`, { data: { documentId: doc.id, title: 'Duplicate draft', questions: fixture } });
  assert.equal(duplicate.status(), 409);
  assert.equal(await db.questionBank.count({ where: { ownerId: userId } }), banksAfterSave);
  pass('duplicate question IDs roll back without leaving orphan banks');
  const wrongCitation = questions(randomUUID());
  const banksBefore = await db.questionBank.count({ where: { ownerId: userId } });
  assert.equal((await context.request.post(`${baseURL}/api/quizzes`, { data: { documentId: doc.id, title: 'Invalid citation', questions: wrongCitation } })).status(), 400);
  assert.equal(await db.questionBank.count({ where: { ownerId: userId } }), banksBefore);
  pass('invalid citations cannot persist orphan question banks');
  // Use fresh IDs after testing a separately saved draft.
  fixture.forEach(q => { const ids = new Map(q.options.map(o => [o.id, randomUUID()])); q.id = randomUUID(); q.correctOptionIds = q.correctOptionIds.map(id => ids.get(id)); q.options = q.options.map(o => ({ ...o, id: ids.get(o.id) })); });
  // The displayed fixture must use the same fresh identities before save.
  await page.getByRole('button', { name: '← Điều chỉnh cấu hình', exact: true }).click();
  await page.getByRole('button', { name: '✦ Tạo đề nháp', exact: true }).click();
  await page.getByRole('heading', { name: 'Kiểm tra trước khi xuất bản' }).waitFor();
  for (const box of await page.getByRole('checkbox', { name: 'Tôi đã kiểm tra câu hỏi, đáp án và lời giải', exact: true }).all()) await box.check();
  await page.getByRole('button', { name: 'Lưu & xuất bản →', exact: true }).click();
  await page.getByRole('heading', { name: 'Bài kiểm tra đã sẵn sàng' }).waitFor();
  const published = await db.quiz.findFirstOrThrow({ where: { ownerId: userId, isPublished: true }, include: { versions: true } });
  assert.equal(published.versions.length, 1);
  pass('reviewed fixture: UI saves and publishes a real immutable database snapshot');
  const attempt = await context.request.post(`${baseURL}/api/attempts/start`, { data: { shareCode: published.shareCode } });
  assert.equal(attempt.status(), 200);
  const payload = await attempt.json();
  assert(!JSON.stringify(payload).includes('explanation'));
  assert(!JSON.stringify(payload).includes('correctOptionIds'));
  assert(!JSON.stringify(payload).includes('acceptedAnswers'));
  pass('active exam response contains no answers or explanations');
  assert.equal(errors.length, 0, errors.join('\n'));
  pass('no browser runtime or hydration errors');
} catch (error) { console.error(error.message); if (browser) { const pages = browser.contexts().flatMap(context => context.pages()); await pages[0]?.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {}); } process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  if (userId) {
    await db.attempt.deleteMany({ where: { userId } });
    await db.quizVersion.deleteMany({ where: { quiz: { ownerId: userId } } });
    await db.quiz.deleteMany({ where: { ownerId: userId } });
    await db.questionBank.deleteMany({ where: { ownerId: userId } });
    await db.document.deleteMany({ where: { ownerId: userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ passed: results.length, checks: results, errors, realAIValidated: false, providerFixtureForReview: true }, null, 2));
}
