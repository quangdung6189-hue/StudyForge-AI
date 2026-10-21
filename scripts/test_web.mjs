/**
 * StudyForge AI — Automated Web End-to-End Test Suite
 * Tests: Public pages, Auth, DAL APIs, SSR Views, Student Exam Flow, Zero-Guest Protection.
 */

const BASE_URL = 'http://localhost:3000';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(headers) {
    const raw = headers.getSetCookie ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
    for (const cookieStr of raw) {
      if (!cookieStr) continue;
      const [pair] = cookieStr.split(';');
      const [name, ...valParts] = pair.split('=');
      if (name && valParts.length) {
        this.cookies.set(name.trim(), valParts.join('=').trim());
      }
    }
  }

  getCookieHeader() {
    const pairs = [];
    for (const [k, v] of this.cookies.entries()) {
      pairs.push(`${k}=${v}`);
    }
    return pairs.join('; ');
  }
}

async function request(path, options = {}, jar = null) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  if (jar) {
    const cookieHeader = jar.getCookieHeader();
    if (cookieHeader) headers['Cookie'] = cookieHeader;
  }
  const res = await fetch(url, { ...options, headers, redirect: options.redirect || 'manual' });
  if (jar) {
    jar.setFromHeaders(res.headers);
  }
  return res;
}

async function runTests() {
  console.log('\n==================================================');
  console.log('       STUDYFORGE AI — E2E WEB TEST SUITE         ');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name}`);
      process.exitCode = 1;
    }
  }

  // Phase 1: Public Pages
  console.log('--- Phase 1: Public Pages ---');
  const homeRes = await request('/');
  assert(homeRes.status === 200, 'Landing Page (/) returns 200 OK');

  const signInRes = await request('/sign-in');
  assert(signInRes.status === 200, 'Sign-In Page (/sign-in) returns 200 OK');

  // Phase 2: Teacher Auth Flow
  console.log('\n--- Phase 2: Teacher Authentication ---');
  const teacherJar = new CookieJar();
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'giaovien@studyforge.vn',
      password: 'GiaoVien2026!',
    }),
  }, teacherJar);
  
  assert(loginRes.status === 200, 'Teacher Login returns 200 OK');
  const loginData = await loginRes.json();
  assert(loginData.success && loginData.user.role === 'teacher', `Teacher User verified: ${loginData.user?.name} (${loginData.user?.role})`);
  assert(teacherJar.cookies.has('studyforge_session'), 'Session cookie "studyforge_session" set');

  // Phase 3: Authenticated APIs
  console.log('\n--- Phase 3: Authenticated APIs (/me, /quizzes, /documents) ---');
  const meRes = await request('/api/auth/me', {}, teacherJar);
  assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
  const meData = await meRes.json();
  assert(meData.user?.email === 'giaovien@studyforge.vn', `Auth user verified: ${meData.user?.email}`);

  const quizzesRes = await request('/api/quizzes', {}, teacherJar);
  assert(quizzesRes.status === 200, 'GET /api/quizzes returns 200 OK');
  const quizzesData = await quizzesRes.json();
  assert(Array.isArray(quizzesData.items) && quizzesData.items.length > 0, `Quizzes found in DB: ${quizzesData.items?.length || 0} items`);
  if (quizzesData.items?.length) {
    console.log(`     Sample Quiz: "${quizzesData.items[0].title}" (ShareCode: ${quizzesData.items[0].shareCode})`);
  }

  const docsRes = await request('/api/documents', {}, teacherJar);
  assert(docsRes.status === 200, 'GET /api/documents returns 200 OK');
  const docsData = await docsRes.json();
  assert(Array.isArray(docsData.items) && docsData.items.length > 0, `Documents found in DB: ${docsData.items?.length || 0} items`);
  if (docsData.items?.length) {
    console.log(`     Sample Document: "${docsData.items[0].title}"`);
  }

  // Phase 4: SSR Workspace Pages
  console.log('\n--- Phase 4: SSR Authenticated Pages ---');
  const ssrPages = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/quizzes', label: 'Quizzes Management' },
    { path: '/quizzes/create', label: 'Create Quiz Flow' },
    { path: '/documents', label: 'Documents Hub' },
    { path: '/study', label: 'Spaced Repetition Study' },
  ];

  for (const page of ssrPages) {
    const res = await request(page.path, {}, teacherJar);
    assert(res.status === 200, `${page.label} (${page.path}) renders 200 OK`);
  }

  // Phase 5: Student Flow & Exam Session
  console.log('\n--- Phase 5: Student Flow & Protected Exam Room ---');
  const studentJar = new CookieJar();
  const studentLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hocsinh@studyforge.vn',
      password: 'HocSinh2026!',
    }),
  }, studentJar);

  assert(studentLoginRes.status === 200, 'Student Login returns 200 OK');
  const studentData = await studentLoginRes.json();
  assert(studentData.user?.role === 'student', `Student verified: ${studentData.user?.name}`);

  const examPageRes = await request('/quizzes/take?code=SINHHOC8DEMO', {}, studentJar);
  assert(examPageRes.status === 200, 'Student Access to Exam Room (/quizzes/take?code=SINHHOC8DEMO) returns 200 OK');

  // Phase 6: Zero Guest Protection (Strict RBAC & Redirection)
  console.log('\n--- Phase 6: Zero Guest Mode Security Enforcement ---');
  const guestDocRes = await request('/api/documents');
  assert(guestDocRes.status === 401, 'Guest GET /api/documents blocked: 401 Unauthorized');

  const guestQuizRes = await request('/api/quizzes');
  assert(guestQuizRes.status === 401, 'Guest GET /api/quizzes blocked: 401 Unauthorized');

  const guestDashRes = await request('/dashboard');
  const isRedirectToSignIn = guestDashRes.status === 307 || guestDashRes.status === 302 || guestDashRes.headers.get('location')?.includes('/sign-in');
  assert(isRedirectToSignIn, `Guest /dashboard strictly redirected to /sign-in (status ${guestDashRes.status}, location: ${guestDashRes.headers.get('location')})`);

  console.log('\n==================================================');
  if (passed === total) {
    console.log(`    ALL ${passed}/${total} END-TO-END TESTS PASSED (100%)! `);
  } else {
    console.log(`    RESULT: ${passed}/${total} tests passed.`);
  }
  console.log('==================================================\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
