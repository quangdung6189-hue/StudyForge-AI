import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const sanitize = args.includes('--sanitize-build-only');
const buildDir = path.resolve(args.find(arg => !arg.startsWith('--')) ?? path.join(root, 'apps/web/.next'));
const manifests = [];

function findManifests(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (directory !== buildDir || !['dev', 'cache'].includes(entry.name)) findManifests(filename);
    } else if (entry.name.endsWith('.nft.json')) {
      manifests.push(filename);
    }
  }
}

try {
  findManifests(buildDir);
  if (!manifests.length) throw new Error('No production .nft.json manifests found. Run the Next.js build first.');

  const failures = new Set();
  let references = 0;
  let removed = 0;
  for (const filename of manifests) {
    const manifest = JSON.parse(readFileSync(filename, 'utf8'));
    if (!Array.isArray(manifest.files) || manifest.files.some(file => typeof file !== 'string')) {
      throw new Error(`Invalid trace manifest: ${path.relative(buildDir, filename)}`);
    }
    const retained = [];
    for (const entry of manifest.files) {
      const target = path.resolve(path.dirname(filename), entry);
      const relative = path.relative(buildDir, target).split(path.sep).join('/');
      if (relative === 'lock' || relative === 'trace' || /^(dev|cache)\//.test(relative)) {
        if (sanitize) { removed++; continue; }
        failures.add(`Build-only file in production trace: ${relative}`);
        continue;
      }
      retained.push(entry);
      references++;
      try {
        lstatSync(target);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        failures.add(`Missing traced file: ${relative}`);
      }
    }
    // Only drop known Next.js build artifacts. Missing runtime entries remain errors.
    if (sanitize && retained.length !== manifest.files.length) {
      writeFileSync(filename, JSON.stringify({ ...manifest, files: retained }));
    }
  }

  if (failures.size) throw new Error([...failures].join('\n'));
  if (removed) console.log(`[build-traces] Removed ${removed} build-only references from production manifests.`);
  console.log(`[build-traces] OK: ${manifests.length} manifests, ${references} file references; no missing or build-only files.`);
} catch (error) {
  console.error(`[build-traces] ${error.message}`);
  process.exitCode = 1;
}