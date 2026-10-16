import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { prefsCss, prefsCssAttributes } from './css';
import { createPrefsStore } from './store';

const MODE = 'look.mode';
const DENSITY = 'look.density';

const SCHEMA = pref.group('Prefs', {
  look: pref.group('Look', {
    mode: pref.enum('Mode', 'dark', ['dark', 'light']),
    density: pref.enum('Density', 'compact', ['compact', 'roomy']),
  }),
  gap: pref.number('Gap', 4, { unit: { scale: 1, suffix: 'px' }, splitBy: [MODE, DENSITY] }),
  surface: pref.color('Surface', '#000000', { splitBy: [MODE] }),
  gridGap: pref.number('Grid gap', 2),
  turn: pref.number('Turn', Math.PI, { unit: { scale: Math.PI / 180, suffix: '°' } }),
  shown: pref.boolean('Shown', true),
  face: pref.string('Face', "O'Neil Sans"),
  tags: { kind: 'list', name: 'Tags', description: '', default: [], item: pref.string('Tag', '') },
});

const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $of: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown) => ({ $by: DENSITY, $of: { compact, roomy } });

const make = (initial: [string, unknown][] = []) =>
  createPrefsStore(SCHEMA, createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial }));

const blocksOf = (css: string): Record<string, string[]> =>
  Object.fromEntries(css.split('\n\n').map((block) => {
    const [head, ...lines] = block.split('\n');
    return [head!.replace(' {', ''), lines.slice(0, -1).map((line) => line.trim())];
  }));

describe('prefsCss', () => {
  it('sets every leaf with a CSS form on the root, by kind, and leaves out a kind with none', () => {
    const blocks = blocksOf(prefsCss(make()));
    expect(blocks[':where(:root)']).toEqual([
      '--look-mode: dark;',
      '--look-density: compact;',
      '--gap: 4px;',
      '--surface: #000000;',
      '--grid-gap: 2;',
      '--turn: 180deg;',
      '--shown: 1;',
      "--face: 'O\\'Neil Sans';",
    ]);
  });

  it('writes a selector under each of its own options, and nothing else when no value is split', () => {
    expect(Object.keys(blocksOf(prefsCss(make())))).toEqual([
      ':where(:root)',
      ":where(:root[data-look-mode='dark'])",
      ":where(:root[data-look-mode='light'])",
      ":where(:root[data-look-density='compact'])",
      ":where(:root[data-look-density='roomy'])",
    ]);
    expect(blocksOf(prefsCss(make()))[":where(:root[data-look-mode='light'])"]).toEqual(['--look-mode: light;']);
  });

  it('writes a split value in a block per option, and on the root at the member the defaults name', () => {
    const store = make([['surface', byMode('#111111', '#eeeeee')], [MODE, 'light']]);
    const blocks = blocksOf(prefsCss(store));
    expect(blocks[':where(:root)']).toContain('--surface: #111111;');
    expect(blocks[":where(:root[data-look-mode='dark'])"]).toEqual(['--look-mode: dark;', '--surface: #111111;']);
    expect(blocks[":where(:root[data-look-mode='light'])"]).toEqual(['--look-mode: light;', '--surface: #eeeeee;']);
  });

  it('writes only the choices a value tells apart, the blocks naming more selectors last', () => {
    const blocks = blocksOf(prefsCss(make([['gap', byMode(byDensity(4, 8), 6)]])));
    expect(Object.keys(blocks)).toEqual([
      ':where(:root)',
      ":where(:root[data-look-mode='dark'])",
      ":where(:root[data-look-mode='light'])",
      ":where(:root[data-look-density='compact'])",
      ":where(:root[data-look-density='roomy'])",
      ":where(:root[data-look-mode='dark'][data-look-density='compact'])",
      ":where(:root[data-look-mode='dark'][data-look-density='roomy'])",
    ]);
    expect(blocks[":where(:root[data-look-mode='light'])"]).toContain('--gap: 6px;');
    expect(blocks[":where(:root[data-look-mode='dark'])"]).toEqual(['--look-mode: dark;']);
    expect(blocks[":where(:root[data-look-mode='dark'][data-look-density='roomy'])"]).toEqual(['--gap: 8px;']);
  });

  it('puts a block naming more selectors after every block naming fewer, wherever its leaf sits in the schema', () => {
    const schema = pref.group('Prefs', {
      gap: pref.number('Gap', 4, { splitBy: ['mode', 'density'] }),
      mode: pref.enum('Mode', 'dark', ['dark', 'light']),
      density: pref.enum('Density', 'compact', ['compact', 'roomy']),
    });
    const initial: [string, unknown][] = [['gap', { $by: 'mode', $of: { dark: { $by: 'density', $of: { compact: 1, roomy: 2 } }, light: 3 } }]];
    const store = createPrefsStore(schema, createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial }));
    const named = Object.keys(blocksOf(prefsCss(store))).map((head) => head.split('[').length - 1);
    expect(named).toEqual([...named].sort((a, b) => a - b));
    expect(named.at(-1)).toBe(2);
  });

  it('reads an option a locus holds nothing for as the default', () => {
    const blocks = blocksOf(prefsCss(make([['surface', { $by: MODE, $of: { dark: '#111111' } }]])));
    expect(blocks[":where(:root[data-look-mode='light'])"]).toContain('--surface: #000000;');
  });

  it('takes its root, its property and attribute names, and a value from the caller', () => {
    const css = prefsCss(make([['surface', byMode('#111111', '#eeeeee')]]), {
      root: '.app',
      property: (path) => (path.startsWith('look.') || path === 'gap' ? null : `--x-${path}`),
      attribute: (selector) => `data-${selector.split('.').pop()}`,
      value: (value, leaf) => (leaf.kind === 'list' ? String((value as unknown[]).length) : leaf.kind === 'boolean' ? null : undefined),
    });
    const blocks = blocksOf(css);
    expect(blocks[':where(.app)']).toEqual(['--x-surface: #111111;', '--x-gridGap: 2;', '--x-turn: 180deg;', "--x-face: 'O\\'Neil Sans';", '--x-tags: 0;']);
    expect(blocks[":where(.app[data-mode='light'])"]).toEqual(['--x-surface: #eeeeee;']);
  });
});

describe('prefsCss at a shadow root', () => {
  it('matches the attributes inside `:host()`', () => {
    const heads = Object.keys(blocksOf(prefsCss(make(), { root: ':host' })));
    expect(heads.slice(0, 2)).toEqual([':where(:host)', ":where(:host([data-look-mode='dark']))"]);
  });
});

describe('prefsCssAttributes', () => {
  it('names each selector with the option the store has it at', () => {
    const store = make([[MODE, 'light']]);
    expect(prefsCssAttributes(store)).toEqual({ 'data-look-mode': 'light', 'data-look-density': 'compact' });
    expect(prefsCssAttributes(store, { attribute: (selector) => `data-${selector.split('.').pop()}` })).toEqual({ 'data-mode': 'light', 'data-density': 'compact' });
  });
});
