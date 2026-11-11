/**
 * Property tests of app mode's icon catalog: the modules a build records, in whatever order its transforms ran,
 * settle to the same tables and every variant's output to the same bytes; a ref is refused exactly when no table
 * holds it as its own glyph, prototype-named refs included. Tables sit on disk beside stand-in icons.gen paths,
 * written once to a temporary directory the file removes when done.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { IconTable } from '@weasel-js/icons';
import { iconCatalog } from './catalog.ts';
import { USED } from './virtual.ts';
import { runs, timeoutFor } from './pbt.fixture.ts';

const g = (body: string, group = 'G', tags: string[] = []) => ({ body, group, tags });
/** Two `core` tables of one owner, as a package's built table and its source one, disagreeing on `undo`. */
const TABLES: IconTable[] = [
  { namespace: 'core', owner: '@core', icons: { undo: g('u1', 'Edit', ['a']), redo: g('r', 'Edit') } },
  { namespace: 'core', owner: '@core', icons: { undo: g('u2', 'Edit'), cut: g('c', 'Clip', ['a']) } },
  { namespace: '__proto__', owner: '@p', icons: JSON.parse('{"__proto__":{"body":"p","group":"G","tags":[]},"x":{"body":"x","group":"G","tags":["a"]}}') },
  { namespace: 'é', owner: '@e', icons: { '😀': g('smile', 'Face', ['a']) } },
];
const REFS = ['core:undo', 'core:redo', 'core:cut', 'core:toString', 'core:constructor', '__proto__:__proto__', '__proto__:x',
  '__proto__:valueOf', 'é:😀', 'é:hasOwnProperty', 'nowhere:x'];
const VARIANTS = { picks: { tags: ['a'] }, faces: { groups: ['Face'] } };

let root = '';
let gens: string[] = [];
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'weasel-icons-catalog-'));
  gens = TABLES.map((t, i) => {
    const dir = join(root, `pkg${i}`);
    mkdirSync(dir);
    writeFileSync(join(dir, 'icons.table.json'), JSON.stringify(t));
    return join(dir, 'icons.gen.ts');
  });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

interface Use { id: string; gens: number[]; refs: string[] }

/** The catalog after recording `uses` in that order and settling: each variant's output, or the error. */
function build(uses: readonly Use[]): string {
  const catalog = iconCatalog(VARIANTS);
  for (const u of uses) catalog.record(u.id, { file: u.id, gens: u.gens.map((i) => gens[i]!), pkg: undefined, refs: u.refs });
  try {
    catalog.settle({});
  } catch (err) {
    return `error: ${(err as Error).message}`;
  }
  const out = [USED, 'all', 'picks', 'faces', 'core', '__proto__', 'é'].map((v) => {
    try {
      return [v, catalog.variant({}, v, false)];
    } catch (err) {
      return [v, (err as Error).message];
    }
  });
  return JSON.stringify(out);
}

const useArb = fc.uniqueArray(fc.record({
  id: fc.constantFrom('/src/a.ts', '/src/b.ts', '/src/c.ts', '/src/__proto__.ts', '/src/é.ts'),
  gens: fc.subarray([0, 1, 2, 3]),
  refs: fc.subarray(REFS, { maxLength: 3 }),
}), { selector: (u) => u.id, minLength: 1, maxLength: 5 });

describe('icon catalog', () => {
  it('settles the same tables, and writes every variant alike, whatever order modules were recorded in', () => {
    let errors = 0;
    let built = 0;
    fc.assert(fc.property(useArb.chain((uses) => fc.tuple(fc.constant(uses), fc.shuffledSubarray(uses, { minLength: uses.length }))),
      ([uses, shuffled]) => {
        const a = build(uses);
        expect(build(shuffled)).toBe(a);
        if (a.startsWith('error')) errors++;
        else built++;
      }), runs(200));
    expect(errors).toBeGreaterThan(20);
    expect(built).toBeGreaterThan(20);
  }, timeoutFor(200, 5));

  it('refuses a ref exactly when no recorded table holds it as its own glyph', () => {
    fc.assert(fc.property(useArb, (uses) => {
      const held = new Map<string, Set<string>>();
      for (const i of new Set(uses.flatMap((u) => u.gens))) {
        const t = TABLES[i]!;
        const names = held.get(t.namespace) ?? new Set();
        for (const n of Object.keys(t.icons)) names.add(n);
        held.set(t.namespace, names);
      }
      const missing = uses.flatMap((u) => u.refs).filter((ref) => {
        const at = ref.indexOf(':');
        return !held.get(ref.slice(0, at))?.has(ref.slice(at + 1));
      });
      const out = build(uses);
      expect(out.startsWith('error'), `${out} / missing ${missing.join(', ')}`).toBe(missing.length > 0);
    }), runs(200));
  }, timeoutFor(200, 5));
});
