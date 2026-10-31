import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import nextConfig from '../apps/web/next.config';

const root = fileURLToPath(new URL('../', import.meta.url));
const appRoot = path.join(root, 'apps/web');

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