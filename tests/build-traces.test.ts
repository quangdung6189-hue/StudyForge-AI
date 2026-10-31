import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-build-traces.mjs', import.meta.url));
const fixtures: string[] = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(files: string[]) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'studyforge-traces-test-'));
  fixtures.push(root);
  const buildDir = path.join(root, '.next');
  const manifestDir = path.join(buildDir, 'server/app/api/health');
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(path.join(manifestDir, 'route.js.nft.json'), JSON.stringify({ version: 1, files }));
  return { root, buildDir, manifest: path.join(manifestDir, 'route.js.nft.json') };
}

const check = (buildDir: string, sanitize = false) => spawnSync(process.execPath, [script, buildDir, ...(sanitize ? ['--sanitize-build-only'] : [])], { encoding: 'utf8', timeout: 10000 });

describe('Production trace verification after Next.js releases its build lock', () => {
  it('reproduces the missing .next/lock failure from deployment packaging', () => {
    const { buildDir } = fixture(['../../../../lock']);
    const result = check(buildDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Build-only file in production trace: lock');
  });

  it('rejects a build lock even if another build still has it on disk', () => {
    const { buildDir } = fixture(['../../../../lock']);
    writeFileSync(path.join(buildDir, 'lock'), '');
    expect(check(buildDir).status).toBe(1);
  });

  it.each(['dev/server/chunk.js', 'cache/webpack/cache.pack', 'trace'])('rejects build-only %s', file => {
    const { buildDir } = fixture([`../../../../${file}`]);
    expect(check(buildDir).status).toBe(1);
  });

  it('does not hide missing runtime files such as a Prisma engine', () => {
    const { buildDir } = fixture(['../../../../../packages/db/.generated/postgres/query_engine.node']);
    const result = check(buildDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing traced file: ../packages/db/.generated/postgres/query_engine.node');
  });

  it('sanitizes only known build artifacts and preserves runtime files', () => {
    const { buildDir, manifest } = fixture(['../../../../lock', '../../../../trace', '../../../../dev/file.js', '../../../../cache/file.pack', 'runtime.js']);
    writeFileSync(path.join(path.dirname(manifest), 'runtime.js'), '');
    const result = check(buildDir, true);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Removed 4 build-only references');
    expect(JSON.parse(readFileSync(manifest, 'utf8')).files).toEqual(['runtime.js']);
    expect(check(buildDir).status).toBe(0);
  });

  it('still fails on missing runtime dependencies while sanitizing build-only entries', () => {
    const { buildDir, manifest } = fixture(['../../../../lock', 'missing-runtime.js']);
    const result = check(buildDir, true);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing traced file: server/app/api/health/missing-runtime.js');
    expect(JSON.parse(readFileSync(manifest, 'utf8')).files).toEqual(['missing-runtime.js']);
  });

  it('accepts server chunks and shared Prisma engines outside the build directory', () => {
    const { root, buildDir } = fixture(['../../../chunks/runtime.js', '../../../../../packages/db/.generated/postgres/query_engine.node']);
    const chunks = path.join(buildDir, 'server/chunks');
    const prisma = path.join(root, 'packages/db/.generated/postgres');
    mkdirSync(chunks, { recursive: true });
    mkdirSync(prisma, { recursive: true });
    writeFileSync(path.join(chunks, 'runtime.js'), '');
    writeFileSync(path.join(prisma, 'query_engine.node'), '');
    const result = check(buildDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK: 1 manifests, 2 file references');
  });
});