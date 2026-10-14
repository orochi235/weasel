import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
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

  it('nests a section declared inside a group as a group of its own there', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        cards: f.group({ floor: f.number(1).section('Size') }).section('View'),
      }),
    );
    const { group } = sectionTree(resolved, { cards: { floor: 1 } });
    expect(Object.keys(group.children)).toEqual(['view']);
    const cards = groupAt(groupAt(group, 'view'), 'cards');
    expect(Object.keys(cards.children)).toEqual(['size']);
    expect(Object.keys(groupAt(cards, 'size').children)).toEqual(['floor']);
  });
});

describe('sectionTree, sections inside a group', () => {
  const resolved = resolveConfigSchema(
    f.schema({
      timing: f
        .group({
          pick: f.number(1),
          line: f.number(2).section('A changed line').block(),
          orb: f.number(3).section('An orb landing'),
          scroll: f.number(4),
        })
        .section('Playback'),
    }),
  );
  const config = { timing: { pick: 1, line: 2, orb: 3, scroll: 4 } };

  it('makes each a group of its own inside the group, in schema order', () => {
    const { group } = sectionTree(resolved, config);
    const timing = groupAt(groupAt(group, 'playback'), 'timing');
    expect(Object.keys(timing.children)).toEqual([
      'pick',
      'a-changed-line',
      'an-orb-landing',
      'scroll',
    ]);
    expect(groupAt(timing, 'a-changed-line').name).toBe('A changed line');
    expect(Object.keys(groupAt(timing, 'a-changed-line').children)).toEqual(['line']);
  });

  it('renests the config to match, and maps a path inside one back to its config path', () => {
    const { values, pathAt } = sectionTree(resolved, config);
    expect(values).toEqual({
      playback: {
        timing: { pick: 1, 'a-changed-line': { line: 2 }, 'an-orb-landing': { orb: 3 }, scroll: 4 },
      },
    });
    expect(pathAt('playback.timing.a-changed-line.line')).toBe('timing.line');
    expect(pathAt('playback.timing.pick')).toBe('timing.pick');
  });

  it('carries block onto the leaf', () => {
    const { group } = sectionTree(resolved, config);
    const timing = groupAt(groupAt(group, 'playback'), 'timing');
    expect(groupAt(timing, 'a-changed-line').children.line).toMatchObject({ block: true });
  });

  it('warns once of a first row that repeats its section heading, at the root and inside a group', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveConfigSchema(
      f.schema({
        pump: f.boolean(true).label('Pump').section('Pumping'),
        rate: f.number(1).label('Rate').section('Pumping'),
        tank: f.group({
          fill: f.boolean(true).label('Fill').section('Filling'),
          level: f.number(1).label('Level').section('Filling'),
        }),
      }),
    );
    const config = { pump: true, rate: 1, tank: { fill: true, level: 1 } };
    sectionTree(resolved, config);
    sectionTree(resolved, config);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[labkit] "Pump" (pump) repeats its heading "Pumping". It is drawn in the heading instead; mark it .heading() to say so, or give it a label of its own.',
      '[labkit] "Fill" (tank.fill) repeats its heading "Filling". It is drawn in the heading instead; mark it .heading() to say so, or give it a label of its own.',
    ]);
    warn.mockRestore();
  });

  it('marks the leaf a heading carries, in a section, a section inside a group, and a group', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveConfigSchema(
      f.schema({
        rate: f.number(1).label('Rate').section('Pumping'),
        pump: f.boolean(true).label('Running').heading().section('Pumping'),
        tank: f
          .group({
            fill: f.boolean(true).label('Fill').section('Filling'),
            level: f.number(1).label('Level').section('Filling'),
            open: f.boolean(false).label('Open').heading(),
          })
          .label('Tank'),
      }),
    );
    const { group } = sectionTree(resolved, { pump: true, rate: 1, tank: { fill: true, level: 1, open: false } });
    const pumping = groupAt(group, 'pumping');
    expect(pumping.children.pump).toMatchObject({ heading: true });
    expect(pumping.children.rate).not.toMatchObject({ heading: true });
    const tank = groupAt(group, 'tank');
    expect(tank.children.open).toMatchObject({ heading: true });
    expect(groupAt(tank, 'filling').children.fill).toMatchObject({ heading: true });
    warn.mockRestore();
  });

  it('leaves a leaf a row where its control cannot sit in a heading', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveConfigSchema(
      f.schema({
        rate: f.number(1).label('Rate').heading().section('Pumping'),
        fill: f
          .boolean(true)
          .label('Fill')
          .section('Filling')
          .render(() => null),
      }),
    );
    const { group } = sectionTree(resolved, { fill: true, rate: 1 });
    expect(groupAt(group, 'pumping').children.rate).not.toMatchObject({ heading: true });
    expect(groupAt(group, 'filling').children.fill).not.toMatchObject({ heading: true });
    warn.mockRestore();
  });

  it('says nothing of a first row marked as its heading, or one with a label of its own', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveConfigSchema(
      f.schema({
        pump: f.boolean(true).label('Pump').heading().section('Pumping'),
        lift: f.number(1).label('Lift').section('View'),
      }),
    );
    sectionTree(resolved, { pump: true, lift: 1 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
