// Builds the extension into dist/chrome and dist/firefox: the same files, each with its own manifest.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { TARGETS, manifestFor } from '../manifest.ts';

const app = resolve(import.meta.dirname, '..');
const dist = resolve(app, 'dist');
const configFile = resolve(app, 'vite.config.ts');
const kitVersion = (JSON.parse(readFileSync(resolve(app, '../../packages/core/package.json'), 'utf8')) as { version: string }).version;

const modes = ['pages', 'content', 'background'] as const;
for (const [i, mode] of modes.entries()) {
  console.log(`devtools-extension: building ${mode} (${i + 1}/${modes.length})`);
  await build({ configFile, mode, logLevel: 'warn' });
}

const built = resolve(dist, 'chrome');
for (const target of TARGETS) {
  const out = resolve(dist, target);
  if (out !== built) {
    rmSync(out, { recursive: true, force: true });
    cpSync(built, out, { recursive: true });
  }
  writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify(manifestFor(target, kitVersion), null, 2)}\n`);
  console.log(`devtools-extension: ${target} → ${out}`);
}
