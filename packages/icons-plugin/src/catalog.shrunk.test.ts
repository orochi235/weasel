/** Counterexamples the icon catalog's properties shrank to. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { iconCatalog } from './catalog.ts';
import { USED } from './virtual.ts';

let root = '';
const genIn = (name: string, table: object): string => {
  const dir = join(root, name);
  mkdirSync(dir);
  writeFileSync(join(dir, 'icons.table.json'), JSON.stringify(table));
  return join(dir, 'icons.gen.ts');
};
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'weasel-icons-catalog-shrunk-')); });
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('shrunk counterexamples', () => {
  it('refuses a ref naming an Object.prototype member its table does not hold', () => {
    const gen = genIn('e', { namespace: 'é', owner: '@e', icons: { a: { body: 'a', group: 'G', tags: [] } } });
    const catalog = iconCatalog({});
    catalog.record('/src/a.ts', { file: '/src/a.ts', gens: [gen], pkg: undefined, refs: ['é:hasOwnProperty'] });
    expect(() => catalog.settle({})).toThrow(/icon "é:hasOwnProperty" is not in @e's table/);
  });
});

describe('shrunk counterexamples: record order', () => {
  it('writes the same variants whichever module was recorded first', () => {
    const core = genIn('core', { namespace: 'core', owner: '@core', icons: { undo: { body: 'u', group: 'G', tags: [] } } });
    const e = genIn('e2', { namespace: 'é', owner: '@e', icons: { a: { body: 'a', group: 'G', tags: [] } } });
    const written = (order: [string, string][]) => {
      const catalog = iconCatalog({});
      for (const [id, gen] of order) catalog.record(id, { file: id, gens: [gen], pkg: undefined, refs: [] });
      catalog.settle({});
      return JSON.stringify([catalog.variant({}, 'all', false), catalog.variant({}, USED, false)]);
    };
    expect(written([['/src/b.ts', core], ['/src/a.ts', e]])).toBe(written([['/src/a.ts', e], ['/src/b.ts', core]]));
  });
});
