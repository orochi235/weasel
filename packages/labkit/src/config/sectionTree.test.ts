import { isPrefLeaf, type PrefGroup } from '@weasel-js/ui';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';

const groupAt = (g: PrefGroup, key: string) => {
  const child = g.children[key];
  if (!child || isPrefLeaf(child)) throw new Error(`${key} is not a group`);
  return child;
};

describe('sectionTree', () => {
  it('makes each root section a top-level group, in schema order', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        lift: f.number(1).section('View'),
        beat: f.number(2).section('Playback'),
        spread: f.number(3).section('View'),
      }),
    );
    const { group } = sectionTree(resolved, { lift: 1, beat: 2, spread: 3 });
    expect(Object.keys(group.children)).toEqual(['view', 'playback']);
    expect(groupAt(group, 'view').name).toBe('View');
    expect(Object.keys(groupAt(group, 'view').children)).toEqual(['lift', 'spread']);
    expect(Object.keys(groupAt(group, 'playback').children)).toEqual(['beat']);
  });

  it('brings a group a section names in whole, so the rail can indent it', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        cards: f
          .group({ floor: f.number(1), cap: f.number(2) })
          .section('View')
          .label('Cards'),
      }),
    );
    const { group } = sectionTree(resolved, { cards: { floor: 1, cap: 2 } });
    const cards = groupAt(groupAt(group, 'view'), 'cards');
    expect(cards.name).toBe('Cards');
    expect(Object.keys(cards.children)).toEqual(['floor', 'cap']);
  });

  it('renests the config to mirror the tree', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        cards: f.group({ floor: f.number(1) }).section('View'),
        beat: f.number(2).section('Playback'),
      }),
    );
    const { values } = sectionTree(resolved, { cards: { floor: 7 }, beat: 9 });
    expect(values).toEqual({ view: { cards: { floor: 7 } }, playback: { beat: 9 } });
  });

  it('cuts what showIf rules out, at any depth', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        lineNumbers: f.boolean(true).section('View'),
        listing: f
          .group({
            dim: f.number(1).showIf((c) => c.lineNumbers === true),
            weight: f.number(0),
          })
          .section('View'),
      }),
    );
    const on = sectionTree(resolved, { lineNumbers: true, listing: { dim: 1, weight: 0 } });
    expect(Object.keys(groupAt(groupAt(on.group, 'view'), 'listing').children)).toEqual([
      'dim',
      'weight',
    ]);
    const off = sectionTree(resolved, { lineNumbers: false, listing: { dim: 1, weight: 0 } });
    expect(Object.keys(groupAt(groupAt(off.group, 'view'), 'listing').children)).toEqual([
      'weight',
    ]);
  });

  it('drops a section nothing in it is showing, rather than opening it onto nothing', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        mode: f.enum<string>('a', ['a', 'b']).section('View'),
        glow: f
          .number(1)
          .section('Diff')
          .showIf((c) => c.mode === 'b'),
      }),
    );
    expect(Object.keys(sectionTree(resolved, { mode: 'b', glow: 1 }).group.children)).toEqual([
      'view',
      'diff',
    ]);
    expect(Object.keys(sectionTree(resolved, { mode: 'a', glow: 1 }).group.children)).toEqual([
      'view',
    ]);
  });

  it('keeps a hidden leaf out unless asked for it', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        seed: f.number(1).hidden().section('Debug'),
        route: f.boolean(true).section('Debug'),
      }),
    );
    expect(Object.keys(groupAt(sectionTree(resolved, {}).group, 'debug').children)).toEqual([
      'route',
    ]);
    expect(Object.keys(groupAt(sectionTree(resolved, {}, true).group, 'debug').children)).toEqual([
      'seed',
      'route',
    ]);
  });

  it('leaves a node no section claimed at the top level', () => {
    const resolved = resolveConfigSchema(
      f.schema({ lift: f.number(1).section('View'), loose: f.number(2) }),
    );
    const { group, values } = sectionTree(resolved, { lift: 1, loose: 2 });
    expect(Object.keys(group.children)).toEqual(['view', 'loose']);
    expect(values.loose).toBe(2);
  });

  it('pathAt gives back the config path a rail path stands for', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        cards: f.group({ floor: f.number(1) }).section('View'),
        loose: f.number(2),
      }),
    );
    const { pathAt } = sectionTree(resolved, { cards: { floor: 1 }, loose: 2 });
    expect(pathAt('view.cards.floor')).toBe('cards.floor');
    expect(pathAt('loose')).toBe('loose');
  });

  it('keys two sections whose labels slug the same apart', () => {
    const resolved = resolveConfigSchema(
      f.schema({ a: f.number(1).section('Hold on'), b: f.number(2).section('Hold-on') }),
    );
    const { group } = sectionTree(resolved, { a: 1, b: 2 });
    expect(Object.keys(group.children)).toEqual(['hold-on', 'hold-on-2']);
  });

  it('ignores a section nested under a group, which buckets rows in a pane', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        cards: f.group({ floor: f.number(1).section('Size') }).section('View'),
      }),
    );
    const { group } = sectionTree(resolved, { cards: { floor: 1 } });
    expect(Object.keys(group.children)).toEqual(['view']);
    expect(Object.keys(groupAt(groupAt(group, 'view'), 'cards').children)).toEqual(['floor']);
  });
});
