import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generate } from './gen-icons.mjs';
import { emitConsumerGen } from './lib/modules.mjs';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);
const REPO = join(import.meta.dirname, '../../..');

describe('gen:icons', () => {
  it('builds one table per package, each name in its own namespace', async () => {
    const { tables } = await generate({ roots: [fixture('alpha'), fixture('beta')], write: false });
    expect(tables.map((t) => t.namespace)).toEqual(['alpha', 'beta']);
    expect(tables[0].icons.dot).toEqual({ body: '<circle cx="10" cy="10" r="2"/>', group: 'Things', tags: ['point'] });
    expect(tables[0].icons.bar.body).toBe('<path d="M4 10h12"/>');
    expect(tables[1].icons.dot.body).toBe('<circle cx="9" cy="9" r="2"/>');
  });

  it('refuses two packages declaring one namespace', async () => {
    await expect(generate({ roots: [fixture('alpha'), fixture('alpha-again')], write: false })).rejects.toThrow(/namespace "alpha" is declared by both/);
  });

  it('refuses one name drawn twice, differently, in a namespace', async () => {
    await expect(generate({ roots: [fixture('twice')], write: false })).rejects.toThrow(/icon "dot" is drawn twice/);
  });

  it('refuses an icons directory with no index.mjs', async () => {
    await expect(generate({ roots: [fixture('no-index')], write: false })).rejects.toThrow(/no index\.mjs/);
  });

  it('gives a root that names a namespace and no groups an icon() and no table', async () => {
    const { tables, consumers } = await generate({ roots: [fixture('alpha'), fixture('consumer')], write: false });
    expect(tables.map((t) => t.namespace)).toEqual(['alpha']);
    expect(consumers).toEqual(['consumer']);
    expect(emitConsumerGen('consumer')).toContain("export const icon = scopedIcon<never>('consumer');");
  });
});

const SKIP = new Set(['node_modules', 'dist', 'fixtures']);
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || SKIP.has(e.name)) return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

// The build collects a name only from an icon() imported from an icons.gen module, so a ref
// written any other way ships as a placeholder.
describe('every icon ref the repo writes', () => {
  const files = ['packages', 'apps']
    .flatMap((d) => sources(join(REPO, d)))
    .filter((f) => !relative(REPO, f).startsWith('packages/icons/'));

  it('comes from a generated icons.gen icon()', () => {
    const own = files.filter((f) => !/icons\.gen\.ts$/.test(f) && /\bscopedIcon\s*[<(]/.test(readFileSync(f, 'utf8')));
    expect(own.map((f) => relative(REPO, f))).toEqual([]);
  });

  it('is never a literal handed to toIconRef', () => {
    const literal = files.filter((f) => /\btoIconRef\(\s*(?:'[^']*'|"[^"]*"|`[^`$]*`)\s*\)/.test(readFileSync(f, 'utf8')));
    expect(literal.map((f) => relative(REPO, f))).toEqual([]);
  });
});
