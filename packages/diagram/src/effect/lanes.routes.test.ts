import { describe, expect, it } from 'vitest';
import { createScene, derivedDepOf, effectivePose, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { diagramScene, type DiagramSpec } from '../fromData';
import { uniqueStages } from './draw';
import { SAMPLES } from './lab/samples';
import { lanes } from './lanes';
import { io, w } from './skipFixture';
import type { EffectPipeline } from './types';

type Box = { x: number; y: number; width: number; height: number };
type Pt = { x: number; y: number };

/** `skip`'s shape again with the image chain running through a stage that
 *  also reads a mask, so the `q.no` wire passes stages in its own lane. */
const PAST: EffectPipeline = {
  stages: [
    io('src', { kind: 'source', inputs: [] }),
    { id: 'q', title: 'high?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }] },
    io('a', { inputs: [{ id: 'in', type: 'image' }, { id: 'm', type: 'mask' }] }),
    io('b', { inputs: [{ id: 'in', type: 'image' }] }),
    io('mix', { inputs: [{ id: 'base', type: 'image' }, { id: 'over', type: 'image' }] }),
    { id: 'cut', title: 'Mask', outputs: [{ id: 'out', type: 'mask' }] },
  ],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['a', 'in']), w(['a', 'out'], ['b', 'in']), w(['b', 'out'], ['mix', 'over']),
    w(['q', 'no'], ['mix', 'base']), w(['cut', 'out'], ['a', 'm']),
  ],
};

/** A feedback wire from the last stage back to the first, past a stage
 *  that spans two lanes. */
const LOOP: EffectPipeline = {
  stages: [
    io('a', { inputs: [{ id: 'in', type: 'image' }, { id: 'back', type: 'image' }] }),
    io('m', { inputs: [{ id: 'in', type: 'image' }, { id: 'k', type: 'mask' }], outputs: [{ id: 'out', type: 'image' }, { id: 'k', type: 'mask' }] }),
    io('b'),
    { id: 'cut', title: 'Mask', outputs: [{ id: 'out', type: 'mask' }] },
  ],
  wires: [w(['a', 'out'], ['m', 'in']), w(['m', 'out'], ['b', 'in']), w(['b', 'out'], ['a', 'back']), w(['cut', 'out'], ['m', 'k'])],
};

function load(p: EffectPipeline) {
  const drawn = lanes(p);
  const specs = diagramScene(drawn.data, drawn.scene);
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry() });
  const pose = (id: string) => effectivePose(scene as never, scene.get(id as never)! as never) as Box;
  const route = (id: string): Pt[] => {
    const path = derivedDepOf(scene as never, id as never)!.path! as { coords: Float32Array };
    return Array.from({ length: path.coords.length / 2 }, (_, i) => ({ x: path.coords[2 * i]!, y: path.coords[2 * i + 1]! }));
  };
  return { specs, pose, route };
}

/** Whether segment `a`–`b` passes inside `box` shrunk by `inset`. */
function crosses(a: Pt, b: Pt, box: Box, inset = 0.5): boolean {
  const [x0, x1, y0, y1] = [box.x + inset, box.x + box.width - inset, box.y + inset, box.y + box.height - inset];
  let [t0, t1] = [0, 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const CASES: Record<string, EffectPipeline> = { past: PAST, loop: LOOP, ...SAMPLES };

describe('lanes wires', () => {
  let labeled = 0;
  for (const [name, p] of Object.entries(CASES)) {
    it(`cross no stage between their ends, and keep labels off titles: ${name}`, () => {
      const { specs, pose, route } = load(p);
      const stages = [...new Set(p.stages.map((s) => s.id))];
      const ownedBy = (t: DiagramSpec, id: string) => t.parent === id || String(t.id).startsWith(`${id}/mark:`);
      const titles = uniqueStages(p).map((s) => {
        const t = specs.find((x) => ownedBy(x, s.id) && (x.data as { text?: string }).text === s.title);
        expect(t, `${name}: ${s.id}'s title`).toBeDefined();
        return { stage: s.id, box: pose(t!.id as string) };
      });
      const edges = specs.filter((s) => (s.data as { diagram?: { from?: unknown } }).diagram?.from !== undefined);
      expect(edges.length).toBeGreaterThan(0);
      labeled += specs.filter((s) => String(s.id).endsWith('/label')).length;
      for (const edge of edges) {
        const [from, to] = edge.dependsOn as unknown as string[];
        const points = route(edge.id as string);
        for (const id of stages) {
          if (id === from || id === to) continue;
          const box = pose(id);
          const hit = points.slice(1).some((b, i) => crosses(points[i]!, b, box));
          expect(hit, `${name}: ${edge.id as string} crosses ${id}`).toBe(false);
        }
        const label = specs.find((s) => s.id === `${edge.id as string}/label`);
        if (label === undefined) continue;
        for (const t of titles) expect(overlap(pose(label.id as string), t.box), `${name}: ${label.id as string} on ${t.stage}'s title`).toBe(false);
      }
    });
  }
  it('had labels to check', () => expect(labeled).toBeGreaterThan(5));
});
