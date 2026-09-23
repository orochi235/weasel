import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const IMPORT =
  /^\s*(?:import|export)\s+(?!type\b)[^'"]*from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;

const isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

function walk(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec?.startsWith('.')) continue;
    const base = resolve(dirname(file), spec.replace(/\.js$/, ''));
    const candidates = [
      resolve(dirname(file), spec),
      `${base}.ts`,
      `${base}.tsx`,
      resolve(base, 'index.ts'),
      resolve(base, 'index.tsx'),
    ];
    const hit = candidates.find(isFile);
    // An import the walk cannot follow would let a stylesheet behind it pass unseen.
    if (!hit) throw new Error(`${file}: cannot resolve ${spec}`);
    walk(hit, seen);
  }
  return seen;
}

describe('@weasel-js/labkit/config', () => {
  it('reaches no stylesheet', () => {
    const files = [...walk(resolve(__dirname, 'index.ts'))];
    expect(files.filter((f) => /\.(less|css)$/.test(f))).toEqual([]);
  });

  // A forge frame loads this entry for every story, and ui's barrel is 167 modules on the dev server.
  it('loads nothing from @weasel-js/ui at runtime', () => {
    const importers = [...walk(resolve(__dirname, 'index.ts'))].filter((file) =>
      [...readFileSync(file, 'utf8').matchAll(IMPORT)].some((m) => (m[1] ?? m[2] ?? m[3])?.startsWith('@weasel-js/ui')),
    );
    expect(importers).toEqual([]);
  });

  it('is published as an entry', async () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.exports['./config']).toEqual({
      types: './dist/config/index.d.ts',
      import: './dist/config/index.js',
    });
  });
});
