import type { NextConfig } from 'next';
import { config } from 'dotenv';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function findMonorepoRoot(startDir: string = process.cwd()): string {
  let curr = path.resolve(startDir);
  while (curr && path.dirname(curr) !== curr) {
    const pkgPath = path.join(curr, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) return curr;
      } catch {}
    }
    curr = path.dirname(curr);
  }
  return path.resolve(startDir, '../..');
}

const root = findMonorepoRoot();
config({ path: path.join(root, '.env'), quiet: true });
process.env.STUDYFORGE_ROOT ??= root;

// Ensure Prisma engines are generated before Next build begins
try {
  const engineLinux = path.join(root, 'packages/db/.generated/postgres/libquery_engine-rhel-openssl-3.0.x.so.node');
  if (!existsSync(engineLinux)) {
    console.log('[next.config.ts] Generating Prisma query engines for build...');
    execSync(`node "${path.join(root, 'scripts/db.mjs')}" generate`, { stdio: 'inherit', cwd: root });
  }
} catch (e) {
  console.warn('[next.config.ts] Could not run pre-generate step:', e);
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: 'bottom-left' },
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-neon', '@neondatabase/serverless', 'ws', 'bcryptjs', 'pdf-parse', 'mammoth', 'nodemailer'],
  transpilePackages: ['@studyforge/contracts', '@studyforge/core', '@studyforge/db', '@studyforge/ai', '@studyforge/storage'],
  outputFileTracingRoot: root,
  outputFileTracingIncludes: {
    '/*': [
      './packages/db/.generated/**/*',
      './node_modules/.prisma/client/**/*',
      './apps/web/.generated/**/*',
      './apps/web/node_modules/.prisma/client/**/*',
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }, { source: '/api/documents/:id/file', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
};
export default nextConfig;
