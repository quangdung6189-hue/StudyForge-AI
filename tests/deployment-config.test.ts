import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import nextConfig from '../apps/web/next.config';

const root = fileURLToPath(new URL('../', import.meta.url));
const appRoot = path.join(root, 'apps/web');
const readJson = (filename: string) => JSON.parse(readFileSync(path.join(root, filename), 'utf8'));

describe('Monorepo deployment file tracing', () => {
  it('allows tracing shared packages outside the Next.js app', () => {
    expect(path.resolve(nextConfig.outputFileTracingRoot!)).toBe(path.resolve(root));
  });

  it.each([
    'packages/db/.generated',
    'node_modules/.prisma/client',
    'apps/web/.generated',
    'apps/web/node_modules/.prisma/client',
  ])('includes Prisma runtime files in %s relative to the app root', directory => {
    const patterns = nextConfig.outputFileTracingIncludes?.['/*'] ?? [];
    const directories = patterns.map(pattern => path.resolve(appRoot, pattern.replace(/\/\*\*\/\*$/, '')));
    expect(directories).toContain(path.resolve(root, directory));
  });
});

describe('Vercel installation settings', () => {
  it('installs root dependencies, build tools and workspaces before running Prisma postinstall', () => {
    const deployment = readJson('apps/web/vercel.json');
    expect(deployment.framework).toBe('nextjs');
    expect(deployment.installCommand).toBe('cd ../.. && npm ci --include=dev --workspaces --include-workspace-root');
    expect(deployment.buildCommand).toBe('npm run build');
  });

  it('pins both manifests and the lockfile to Node.js 22 instead of an open-ended range', () => {
    const manifest = readJson('package.json');
    const web = readJson('apps/web/package.json');
    const lock = readJson('package-lock.json');
    expect(manifest.engines.node).toBe('>=22.12 <23');
    expect(web.engines).toEqual(manifest.engines);
    expect(lock.packages[''].engines).toEqual(manifest.engines);
    expect(lock.packages['apps/web'].engines).toEqual(web.engines);
  });
});