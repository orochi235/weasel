import { describe, expect, it } from 'vitest';
import { chain } from './chain';
import { graphOf } from './groupFixture';
import type { LayoutResult } from './layout';

// `graphOf` seeds node i at (i, i), 100 by 40.
const IDS = ['src', 'blur', 'mix', 'out', 'osc', 'mask'] as const;
const EDGES = [['src', 'blur'], ['blur', 'mix'], ['mix', 'out'], ['osc', 'blur'], ['mask', 'mix']] as const;
const graph = graphOf(IDS, EDGES, {});
const at = (result: LayoutResult, id: string) => result.get(id) ?? { x: IDS.indexOf(id as never), y: IDS.indexOf(id as never) };
const OPTS = { direction: 'right', chain: ['src', 'blur', 'mix', 'out'] } as const;

describe('chain', () => {
  it('stands the chain on one line, in order', () => {
    const r = chain(graph, OPTS);
    const line = OPTS.chain.map((id) => at(r, id));
    expect(new Set(line.map((p) => p.y)).size).toBe(1);
    expect(line.map((p) => p.x)).toEqual([...line.map((p) => p.x)].sort((a, b) => a - b));
    expect(new Set(line.map((p) => p.x)).size).toBe(4);
  });

  it('hangs each other node past the line, in its chain node\'s column', () => {
    const r = chain(graph, OPTS);
    expect(at(r, 'osc').y).toBeGreaterThan(at(r, 'blur').y + 40);
    expect(at(r, 'osc').x).toBe(at(r, 'blur').x);
    expect(at(r, 'mask').x).toBe(at(r, 'mix').x);
  });

  it('hangs on the other side when asked', () => {
    const r = chain(graph, { ...OPTS, chainSide: 'before' });
    expect(at(r, 'osc').y + 40).toBeLessThan(at(r, 'blur').y);
  });

  it('starts where the graph did, and moves nothing on a second run', () => {
    const r = chain(graph, OPTS);
    const xs = IDS.map((id) => at(r, id).x);
    const ys = IDS.map((id) => at(r, id).y);
    expect([Math.min(...xs), Math.min(...ys)]).toEqual([0, 0]);
    const settled = graphOf(IDS, EDGES, {});
    settled.nodes.forEach((n) => Object.assign(n.bounds, at(r, n.id)));
    expect(chain(settled, OPTS).size).toBe(0);
  });

  it('takes the longest path as the chain when none is named', () => {
    const r = chain(graph, { direction: 'right' });
    expect(new Set(['src', 'blur', 'mix', 'out'].map((id) => at(r, id).y)).size).toBe(1);
  });

  it('takes the longest path when no id it is given is a node', () => {
    const r = chain(graph, { direction: 'right', chain: ['ghost', 'phantom'] });
    expect(new Set(['src', 'blur', 'mix', 'out'].map((id) => at(r, id).y)).size).toBe(1);
    expect(at(r, 'osc').y).toBeGreaterThan(at(r, 'blur').y + 40);
  });

  it('answers an empty graph with nothing', () => {
    expect(chain(graphOf([], [], {}), OPTS).size).toBe(0);
  });
});
