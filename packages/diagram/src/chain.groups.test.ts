import { describe, expect, it } from 'vitest';
import { chain } from './chain';
import { rack } from './effect/rack';
import { io, w } from './effect/skipFixture';
import type { EffectPipeline } from './effect/types';
import { diagramScene } from './fromData';
import { graphOf, overlaps, type Rect } from './groupFixture';
import type { LayoutResult } from './layout';

// `graphOf` seeds node i at (i, i), 100 by 40.
const IDS = ['src', 'a', 'b', 'c', 'out', 'sa', 'sc'] as const;
const EDGES = [['src', 'a'], ['a', 'b'], ['b', 'c'], ['c', 'out'], ['sa', 'a'], ['sc', 'c']] as const;
const OPTS = { direction: 'right', chain: ['src', 'a', 'b', 'c', 'out'] } as const;
const ALL: readonly string[] = [...IDS, 'ma'];
const at = (result: LayoutResult, id: string) => result.get(id) ?? { x: ALL.indexOf(id), y: ALL.indexOf(id) };

describe('chain with groups', () => {
  it('hangs a member on a line member of its own group', () => {
    // sc hangs off c by breadth-first search, but c is outside g.
    const r = chain(graphOf(IDS, EDGES, { g: ['b', 'sc'] }), OPTS);
    expect(at(r, 'sc').x).toBe(at(r, 'b').x);
  });

  it('moves an outsider past the members hung in a group column', () => {
    const r = chain(graphOf([...IDS, 'ma'], [...EDGES, ['ma', 'a']], { g: ['a', 'ma'] }), OPTS);
    expect(at(r, 'sa').y).toBeGreaterThan(at(r, 'ma').y + 40);
  });

  it('hangs a group with no line member on the owner most of its members had', () => {
    const ids = [...IDS, 'x', 'y'];
    const r = chain(graphOf(ids, [...EDGES, ['x', 'c'], ['y', 'c'], ['sa', 'x']], { g: ['sa', 'x', 'y'] }), OPTS);
    // c's column holds four hung nodes, so sa sits somewhere in it rather than under c.
    expect(at(r, 'sa').x).toBeGreaterThan(at(r, 'b').x + 100);
    expect(at(r, 'sa').x).toBeLessThan(at(r, 'out').x);
  });

  it('leaves room beside a group for its box', () => {
    const plain = chain(graphOf(IDS, EDGES, {}), OPTS);
    const grouped = chain(graphOf(IDS, EDGES, { g: ['b'] }, 12), OPTS);
    const gap = (r: LayoutResult, l: string, rt: string) => at(r, rt).x - at(r, l).x;
    expect(gap(grouped, 'a', 'b')).toBe(gap(plain, 'a', 'b') + 12);
    expect(gap(grouped, 'b', 'c')).toBe(gap(plain, 'b', 'c') + 12);
  });

  it('leaves room for a box widened to its minWidth', () => {
    const plain = chain(graphOf(IDS, EDGES, {}), OPTS);
    const base = graphOf(IDS, EDGES, { g: ['b'] }, 12);
    const wide = { ...base, groups: base.groups!.map((g) => ({ ...g, minWidth: 400 })) };
    const grouped = chain(wide, OPTS);
    const gap = (r: LayoutResult, l: string, rt: string) => at(r, rt).x - at(r, l).x;
    // b's box is 100 + 2 * 12 = 124 wide, so it grows 138 on each side.
    expect(gap(grouped, 'a', 'b')).toBe(gap(plain, 'a', 'b') + 12 + 138);
    expect(gap(grouped, 'b', 'c')).toBe(gap(plain, 'b', 'c') + 12 + 138);
  });

  it('lays out a group whose line members a non-member splits', () => {
    const graph = graphOf(IDS, EDGES, { g: ['a', 'c'] });
    const r = chain(graph, OPTS);
    const xs = OPTS.chain.map((id) => at(r, id).x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
  });
});

describe('rack with groups', () => {
  // b's group holds kb, which feeds c: hung by distance alone it would sit under c.
  const PIPELINE: EffectPipeline = {
    types: { number: { control: true } },
    stages: [
      io('src', { inputs: [] }),
      io('a', { inputs: [{ id: 'in', type: 'image' }, { id: 'k', type: 'number' }] }),
      io('b', { inputs: [{ id: 'in', type: 'image' }, { id: 'k', type: 'number' }] }),
      io('c', { inputs: [{ id: 'in', type: 'image' }, { id: 'k', type: 'number' }, { id: 'j', type: 'number' }] }),
      io('out', { outputs: [] }),
      ...['ka', 'kb', 'kc'].map((id) => ({ id, title: id, outputs: [{ id: 'value', type: 'number' }] })),
    ],
    wires: [
      w(['src', 'out'], ['a', 'in']), w(['a', 'out'], ['b', 'in']), w(['b', 'out'], ['c', 'in']), w(['c', 'out'], ['out', 'in']),
      w(['ka', 'value'], ['a', 'k']), w(['kb', 'value'], ['c', 'j']), w(['kc', 'value'], ['c', 'k']),
    ],
    groups: [{ id: 'g', label: 'a much longer group title than its stages', members: ['a', 'b', 'ka', 'kb'] }],
  };

  it('draws no outsider inside a group box', () => {
    const drawn = rack(PIPELINE);
    const specs = diagramScene(drawn.data, drawn.scene);
    const pose = (id: string) => specs.find((s) => s.id === id)!.pose as Rect;
    const box = pose('g');
    for (const id of ['src', 'c', 'out', 'kc']) expect(overlaps(box, pose(id)), id).toBe(false);
  });
});
