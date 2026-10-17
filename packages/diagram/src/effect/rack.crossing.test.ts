import { describe, expect, it } from 'vitest';
import { EDGE_DERIVE_PATH } from '../edge';
import { diagramScene, type DiagramSpec } from '../fromData';
import { rack } from './rack';
import { io, w } from './skipFixture';
import type { EffectPipeline } from './types';

type Pt = [number, number];

/** Every drawn edge, as the polyline the scene would paint. */
function routes(specs: readonly DiagramSpec[]): Map<string, Pt[]> {
  const byId = new Map<string, DiagramSpec>(specs.map((s) => [String(s.id), s]));
  const out = new Map<string, Pt[]>();
  for (const spec of specs) {
    if (spec.dependsOn === undefined || spec.derivePath === undefined) continue;
    const deps = (spec.dependsOn as readonly unknown[]).map((id) => {
      const node = byId.get(String(id))!;
      return { node: node as never, pose: node.pose };
    });
    const path = EDGE_DERIVE_PATH({ data: spec.data }, deps as never) as { coords: Float32Array } | null;
    if (path === null) continue;
    const c = path.coords;
    out.set(String(spec.id), Array.from({ length: c.length / 2 }, (_, i): Pt => [c[2 * i]!, c[2 * i + 1]!]));
  }
  return out;
}

const cross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const side = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/** The pairs of routes that cross, by edge id. Shared ends do not count. */
function crossings(paths: ReadonlyMap<string, Pt[]>): string[] {
  const list = [...paths];
  const found: string[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [ia, a] = list[i]!;
      const [ib, b] = list[j]!;
      const hit = a.slice(1).some((p, s) => b.slice(1).some((q, t) => cross(a[s]!, p, b[t]!, q)));
      if (hit) found.push(`${ia} x ${ib}`);
    }
  }
  return found;
}

/** `count` side stages, each feeding its own side input of one stage on the
 *  line, listed in `order` while the inputs run l1, l2, …. */
function fan(count: number, order: 'same' | 'reversed' = 'same'): EffectPipeline {
  const layers = Array.from({ length: count }, (_, i) => `l${i + 1}`);
  const hung = layers.map((l, i) => ({ id: `layer-${l}`, title: `Layer ${i + 1}`, outputs: [{ id: 'out', type: 'image' }] }));
  return {
    types: {},
    stages: [
      io('src', { inputs: [] }),
      io('mix', { inputs: [{ id: 'in', type: 'image' }, ...layers.map((l) => ({ id: l, type: 'image' }))] }),
      io('out', { outputs: [] }),
      ...(order === 'same' ? hung : [...hung].reverse()),
    ],
    wires: [w(['src', 'out'], ['mix', 'in']), w(['mix', 'out'], ['out', 'in']), ...layers.map((l) => w([`layer-${l}`, 'out'], ['mix', l]))],
  };
}

const drawnCrossings = (pipeline: EffectPipeline, side: 'below' | 'above') => {
  const drawn = rack(pipeline, { side });
  return crossings(routes(diagramScene(drawn.data, drawn.scene)));
};

describe('rack side wires', () => {
  it.each(['below', 'above'] as const)('do not cross on their way into one stage, side %s', (side) => {
    expect(drawnCrossings(fan(6), side)).toEqual([]);
  });

  it.each([2, 3, 5, 8])('do not cross for %i side stages', (count) => {
    expect(drawnCrossings(fan(count), 'below')).toEqual([]);
  });

  it('do not cross when the side stages are listed against their inputs\' order', () => {
    expect(drawnCrossings(fan(6, 'reversed'), 'below')).toEqual([]);
    expect(drawnCrossings(fan(6, 'reversed'), 'above')).toEqual([]);
  });

});
