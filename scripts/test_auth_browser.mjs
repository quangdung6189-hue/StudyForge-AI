import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import bcrypt from 'bcryptjs';
import { db } from '../packages/db/src/index.ts';

const baseURL = process.env.APP_URL || 'http://localhost:3000';
const artifacts = path.resolve('.data/browser-auth-checks');
const email = `browser-check-${randomBytes(8).toString('hex')}@example.com`;
const password = `BrowserCheck-${randomBytes(20).toString('hex')}`;
const results = [];
const runtimeErrors = [];
let browser;
let createdUserId;

function pass(name, details = {}) {
  results.push({ name, passed: true, ...details });
  console.log(`PASS: ${name}`);
}

function monitor(page) {
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydrat|didn't match|server rendered HTML/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });
}

async function loadSignIn(page, url = '/sign-in') {
  await page.goto(new URL(url, baseURL).href, { waitUntil: 'networkidle' });
  await page.getByLabel('Email', { exact: true }).waitFor();
  // Verify hydration through a real interaction rather than React's private DOM keys.
  await page.getByRole('button', { name: 'Tạo tài khoản mới', exact: true }).click();
  await page.getByLabel('Họ và tên', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
  await page.getByLabel('Họ và tên', { exact: true }).waitFor({ state: 'hidden' });
}

async function checkLayout(page, name) {
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth, width: document.documentElement.scrollWidth,
    card: (() => { const rect = document.querySelector('.u062').getBoundingClientRect(); return { left: rect.left, right: rect.right }; })(),
    background: getComputedStyle(document.querySelector('.u062')).backgroundColor,
  }));
  assert(geometry.width <= geometry.viewport + 1, `${name}: horizontal page overflow`);
  assert(geometry.card.left >= 0 && geometry.card.right <= geometry.viewport + 1, `${name}: card clipped`);
  const controlsFit = await page.locator('.u062 input, .u062 select, .u062 button').evaluateAll(elements => elements.every(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth + 1;
  }));
  assert(controlsFit, `${name}: form control clipped`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  pass(name, geometry);
  return geometry;
}

async function checkExtensionHydration() {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  // Inject at the instrumentation bundle boundary while preserving Next's HTML stream.
  await context.route('**/_next/static/chunks/**/*.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    if (!source.includes('bis_skin_checked') || !source.includes('processedMarker')) {
      await route.fulfill({ response });
      return;
    }
    const injected = `
      globalThis.__studyforge_extension_fixture__ = document.querySelectorAll('div').length;
      for (const element of document.querySelectorAll('div')) element.setAttribute('bis_skin_checked', '1');
      document.body?.setAttribute('bis_register', 'extension-test');
      document.body?.setAttribute('__processed_01337bcd-fbf9-42d5-9910-9d49f52c3d97__', 'true');
    `;
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    await route.fulfill({ status: response.status(), headers, body: injected + source });
  });
  const page = await context.newPage();
  monitor(page);
  try {
    await loadSignIn(page);
    assert(await page.evaluate(() => globalThis.__studyforge_extension_fixture__ > 0), 'The extension fixture must modify real DOM nodes before instrumentation');
    await page.waitForFunction(() => document.querySelectorAll('[bis_skin_checked], [bis_register], [__processed_01337bcd-fbf9-42d5-9910-9d49f52c3d97__]').length === 0);
    pass('Extension attributes cleaned before real React hydration; form remains interactive');
  } finally {
    await context.close();
  }
}

try {
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  for (const width of [375, 1280]) {
    const backgrounds = [];
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 812 }, colorScheme, reducedMotion: 'reduce', locale: 'vi-VN' });
      const page = await context.newPage();
      monitor(page);
      await loadSignIn(page);
      backgrounds.push((await checkLayout(page, `signin-${width}-${colorScheme}`)).background);
      const duration = await page.locator('.u062').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration));
      assert(duration < 0.01, 'Reduced motion must suppress the card transition');
      await page.getByRole('button', { name: 'Tạo tài khoản mới', exact: true }).click();
      await page.getByLabel('Họ và tên', { exact: true }).waitFor();
      await checkLayout(page, `register-${width}-${colorScheme}`);
      await context.close();
    }
    assert.notEqual(backgrounds[0], backgrounds[1], 'Light and dark themes must use different surface colors');
  }
  pass('Reduced motion and distinct light/dark theme tokens');

  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(new URL('/sign-in', baseURL).href, { waitUntil: 'domcontentloaded' });
  assert(await staticPage.getByRole('button', { name: 'Đăng nhập', exact: true }).isDisabled());
  assert.equal(await staticPage.locator('form.u062-pane').getAttribute('method'), 'post');
  assert.equal(await staticPage.locator('form.u062-pane').getAttribute('action'), '/api/auth/login');
  await staticContext.close();
  pass('Before hydration, native form controls are disabled and credentials cannot be submitted in a GET URL');

  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'vi-VN' });
  const page = await context.newPage();
  monitor(page);
  await loadSignIn(page);
  const emailInput = page.getByLabel('Email', { exact: true });
  const passwordInput = page.getByLabel('Mật khẩu', { exact: true });
  await emailInput.fill(email);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'auth-password');
  await passwordInput.fill(password);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Hiện mật khẩu');
  await page.keyboard.press('Space');
  assert.equal(await passwordInput.getAttribute('type'), 'text');
  await page.keyboard.press('Space');
  assert.equal(await passwordInput.getAttribute('type'), 'password');
  assert.equal(await emailInput.getAttribute('autocomplete'), 'username');
  assert.equal(await passwordInput.getAttribute('autocomplete'), 'current-password');
  pass('Keyboard navigation, show/hide password, and password-manager field attributes');

  const failedLogin = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  assert.equal((await failedLogin).status(), 401);
  await page.locator('.u062').getByRole('alert').waitFor();
  assert(await page.getByRole('button', { name: 'Đăng nhập', exact: true }).isEnabled());
  pass('Wrong credentials show an accessible error and allow retry');

  await page.getByRole('button', { name: 'Tạo tài khoản mới', exact: true }).click();
  await page.getByLabel('Họ và tên', { exact: true }).fill('Browser Verification');
  await passwordInput.fill('short');
  assert.equal(await passwordInput.evaluate(element => element.checkValidity()), false);
  await passwordInput.fill(password);
  const registered = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng ký ngay', exact: true }).click();
  const registrationResponse = await registered;
  assert.equal(registrationResponse.status(), 200);
  const registration = await registrationResponse.json();
  createdUserId = registration.user.id;
  assert.equal(registration.user.passwordHash, undefined);
  await page.waitForURL('**/dashboard');
  await page.locator('.app-shell').waitFor();
  const user = await db.user.findUniqueOrThrow({ where: { id: createdUserId } });
  assert.equal(user.email, email);
  assert.equal(user.googleSubject, null);
  assert.notEqual(user.passwordHash, password);
  assert(await bcrypt.compare(password, user.passwordHash));
  assert(!Object.values(user).includes(password));
  pass('Real browser registration persists a bcrypt hash and reaches the authenticated dashboard');

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    await page.goto(new URL('/sign-in', baseURL).href, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('link', { name: 'Tiếp tục với Google', exact: true }).getAttribute('href'), '/api/auth/google');
    assert.equal(await page.getByRole('link', { name: 'Liên kết Google với tài khoản hiện tại', exact: true }).getAttribute('href'), '/api/auth/google?intent=link');
    assert(await page.getByText(`Tài khoản hiện tại: ${email}`, { exact: true }).isVisible());
    await checkLayout(page, 'account-link-375-light');
    pass('Authenticated users can distinguish Google sign-in from linking the current account');
    await page.goto(new URL('/dashboard', baseURL).href);
    await page.locator('.app-shell').waitFor();
  }

  const sessionCookie = (await context.cookies(baseURL)).find(cookie => cookie.name === 'studyforge_session');
  assert(sessionCookie?.httpOnly);
  assert.equal(sessionCookie.sameSite, 'Lax');
  const session = await db.session.findUniqueOrThrow({ where: { tokenHash: createHash('sha256').update(sessionCookie.value).digest('hex') } });
  assert.equal(session.userId, createdUserId);
  const reopened = await browser.newContext({ storageState: await context.storageState() });
  const reopenedPage = await reopened.newPage();
  monitor(reopenedPage);
  await reopenedPage.goto(new URL('/dashboard', baseURL).href);
  await reopenedPage.locator('.app-shell').waitFor();
  assert.equal((await reopened.request.get(new URL('/api/auth/me', baseURL).href)).status(), 200);
  pass('HttpOnly cookie matches the hashed database session and survives reopening a browser context');

  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/sign-in');
  const loggedOutIdentity = await reopened.request.get(new URL('/api/auth/me', baseURL).href);
  assert.deepEqual(await loggedOutIdentity.json(), { authenticated: false, user: null });
  assert.equal((await reopened.request.get(new URL('/api/documents', baseURL).href)).status(), 401);
  assert.equal(await db.session.count({ where: { tokenHash: session.tokenHash } }), 0);
  await reopened.close();
  await page.goto(new URL('/dashboard', baseURL).href);
  await page.waitForURL('**/sign-in');
  pass('Logout deletes the database session; copied cookies and guest dashboard access are rejected');

  await loadSignIn(page);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const loggedIn = await db.user.findUniqueOrThrow({ where: { id: createdUserId } });
  assert(loggedIn.lastLoginAt);
  assert.equal(loggedIn.passwordHash, user.passwordHash);
  pass('Subsequent password login uses the saved hash and updates lastLoginAt');

  const googleResponse = await context.request.get(new URL('/api/auth/google', baseURL).href, { maxRedirects: 0 });
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    assert.equal(googleResponse.status(), 303);
    assert(googleResponse.headers().location.includes('google_error=not_configured'));
    pass('Missing Google configuration fails safely without pretending to authenticate');
  } else {
    assert.equal(new URL(googleResponse.headers().location).origin, 'https://accounts.google.com');
    pass('Configured Google authorization redirects to the real Google domain');
  }
  await context.close();
  await checkExtensionHydration();
  assert.deepEqual(runtimeErrors, [], 'No page errors or hydration errors are allowed');
  pass('No JavaScript runtime errors or hydration mismatches');
} catch (error) {
  console.error(error.message);
  results.push({ name: 'Browser authentication verification', passed: false, error: error.message });
  process.exitCode = 1;
} finally {
  await browser?.close();
  // Delete only the unique throwaway account created by this run, including its sessions.
  if (createdUserId) await db.user.deleteMany({ where: { id: createdUserId, email } });
  await db.$disconnect();
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(artifacts, 'report.json'), JSON.stringify({ results, runtimeErrors }, null, 2));
  console.log(`Browser report: ${path.join(artifacts, 'report.json')}`);
}
