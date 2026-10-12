import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { applyPrefConditions, prefJudge, prefScopeAt } from './scope';

const flag = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const alias = (of: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'alias', name: '', description: '', default: undefined, of, ...extra }) as PrefLeaf;

const schema: PrefGroup = {
  name: '',
  children: {
    pageOn: flag('Page on'),
    pageOpen: flag('Page open'),
    gridOn: flag('Grid on'),
    gridOpen: flag('Grid open'),
    quickOn: flag('Quick on'),
    quickOpen: flag('Quick open'),
    view: {
      name: 'View',
      showIf: { path: 'pageOn' },
      enableIf: { path: 'pageOpen' },
      children: { grid: flag('Grid', { showIf: { path: 'gridOn' }, enableIf: { path: 'gridOpen' } }) },
    },
    quick: alias('view.grid', { showIf: { path: 'quickOn' }, enableIf: { path: 'quickOpen' } }),
    again: alias('quick'),
    dead: alias('view.gone', { enableIf: { path: 'quickOpen' } }),
  },
};
const ALL = { pageOn: true, pageOpen: true, gridOn: true, gridOpen: true, quickOn: true, quickOpen: true };
const over = (off: keyof typeof ALL | null, root: PrefGroup | PrefSection = schema) =>
  prefJudge(root, (path) => prefValueAtPath(off === null ? ALL : { ...ALL, [off]: false }, path));

describe('an alias row', () => {
  it('is shown and enabled while its own conditions, its target\'s, and those of every group above the target hold', () => {
    const applied = applyPrefConditions(schema, over(null));
    expect(applied.shown).toBe(schema);
    expect([...applied.disabled]).toEqual([]);
    expect(prefScopeAt(schema, 'quick', over(null))).toEqual({ shown: true, enabled: true });
  });

  it('is not shown while any one of the three showIfs fails', () => {
    for (const off of ['quickOn', 'gridOn', 'pageOn'] as const) {
      const { shown } = applyPrefConditions(schema, over(off));
      expect(Object.keys(shown!.children), off).not.toContain('quick');
      expect(prefScopeAt(schema, 'quick', over(off)), off).toEqual({ shown: false, enabled: true });
    }
  });

  it('is disabled while any one of the three enableIfs fails', () => {
    for (const off of ['quickOpen', 'gridOpen', 'pageOpen'] as const) {
      const { shown, disabled } = applyPrefConditions(schema, over(off));
      expect(Object.keys(shown!.children), off).toContain('quick');
      expect(disabled.has('quick'), off).toBe(true);
      expect(prefScopeAt(schema, 'quick', over(off)), off).toEqual({ shown: true, enabled: false });
    }
  });

  it('answers for the leaf at the end of a chain of aliases, and for itself alone when it names none', () => {
    expect(Object.keys(applyPrefConditions(schema, over('gridOn')).shown!.children)).not.toContain('again');
    expect(applyPrefConditions(schema, over('pageOpen')).disabled.has('again')).toBe(true);
    // The alias between them is a second place for the leaf, not something above it.
    expect(applyPrefConditions(schema, over('quickOpen')).disabled.has('again')).toBe(false);
    expect(prefScopeAt(schema, 'dead', over('gridOn'))).toEqual({ shown: true, enabled: true });
    expect(prefScopeAt(schema, 'dead', over('quickOpen'))).toEqual({ shown: true, enabled: false });
  });

  it('is named in hidden, and kept, where hidden nodes are kept', () => {
    const { shown, hidden } = applyPrefConditions(schema, over('gridOn'), { keepHidden: true });
    expect(Object.keys(shown!.children)).toContain('quick');
    expect([...hidden]).toEqual(['view.grid', 'quick', 'again']);
  });

  it('reads its target from another schema when told which', () => {
    const layout: PrefGroup = { name: '', children: { here: alias('view.grid') } };
    const judge = over('pageOpen');
    expect(applyPrefConditions(layout, judge).disabled.has('here')).toBe(false);
    expect(applyPrefConditions(layout, judge, { aliasOver: schema }).disabled.has('here')).toBe(true);
    expect(prefScopeAt(layout, 'here', judge, { aliasOver: schema })).toEqual({ shown: true, enabled: false });
    expect(applyPrefConditions(layout, over('gridOn'), { aliasOver: schema }).shown).toEqual({ name: '', children: {} });
  });

  it('counts the sections above its target in a section schema', () => {
    const node: PrefSection = {
      name: '',
      members: {
        'data.on': flag('On'),
        look: { name: 'Look', showIf: { path: 'data.on' }, members: { 'data.fill': flag('Fill') } },
        'data.also': alias('data.fill'),
      },
    };
    const judge = (on: boolean) => prefJudge(node, (path) => (path === 'data.on' ? on : undefined));
    expect(Object.keys(applyPrefConditions(node, judge(true)).shown!.members)).toEqual(['data.on', 'look', 'data.also']);
    expect(Object.keys(applyPrefConditions(node, judge(false)).shown!.members)).toEqual(['data.on']);
    expect(prefScopeAt(node, 'data.also', judge(false)).shown).toBe(false);
    expect(prefScopeAt(node, 'data.fill', judge(false)).shown).toBe(false);
  });
});
