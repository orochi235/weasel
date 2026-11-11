/**
 * Property tests of `buildSceneTree` over generated scenes: nested groups that clip to their own box, three
 * layers some hidden, nodes hidden. What it paints, in order, is checked against the scene's own render order
 * (which picking walks, so the topmost painted node is the topmost picked one) and against a model of the
 * tree; each paint against the clips of its ancestors; a one-layer build against the full one's group; and a
 * cull against the paint it skips.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { sceneToAdapter } from './sceneAdapter';
import {
  LAYERS, ancestorsOf, buildScene, clipBox, layerOf, modelHidden, nodeIdOf, runs, sceneSpec, timeoutFor,
  type Box, type SceneSpec,
} from './pbt.fixture';

const RUNS = 200;
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const draw = (node: { id: string }, pose: Box): DrawCommand[] =>
  [{ kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: node.id } } } as DrawCommand];

interface Painted { id: string; clips: unknown[]; layer: number }

/** Every paint in `out`, in draw order, with the clips wrapped around it outermost first and the top-level group it is in. */
function flatten(out: readonly DrawCommand[]): Painted[] {
  const found: Painted[] = [];
  const visit = (c: DrawCommand, clips: unknown[], layer: number): void => {
    if (c.kind === 'group') {
      const g = c as { clip?: unknown; children: DrawCommand[] };
      const inner = g.clip !== undefined ? [...clips, g.clip] : clips;
      for (const k of g.children) visit(k, inner, layer);
    } else if (c.kind === 'path') {
      found.push({ id: (c as { fill: { paint: { color: string } } }).fill.paint.color, clips, layer });
    }
  };
  out.forEach((c, i) => visit(c, [], i));
  return found;
}

/** The model: each shown layer in turn, the tree in preorder, nodes on that layer, under no hidden node. */
function modelOrder(spec: SceneSpec): string[] {
  const kids = (p: number | null) => spec.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.parent === p).map(({ i }) => i);
  const out: string[] = [];
  for (const layer of LAYERS) {
    if (!layerOf(spec, layer).visible) continue;
    const visit = (i: number): void => {
      if (spec.nodes[i]!.hidden) return;
      if (spec.nodes[i]!.layer === layer) out.push(nodeIdOf(i));
      kids(i).forEach(visit);
    };
    kids(null).forEach(visit);
  }
  return out;
}

const clipsOf = (spec: SceneSpec, i: number) => ancestorsOf(spec, i).reverse()
  .filter((k) => spec.nodes[k]!.group && spec.nodes[k]!.clip)
  .map((k) => ({ kind: 'rect', ...clipBox(spec.nodes[k]!.pose) }));

const indexOf = (id: string) => Number(id.slice(1));

describe('buildSceneTree', () => {
  it('paints the shown nodes in the scene render order, each inside its ancestors’ clips', () => {
    let clipped = 0, nested = 0, skipped = 0;
    fc.assert(fc.property(sceneSpec, (spec) => {
      const scene = buildScene(spec);
      const painted = flatten(buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW));
      const ids = painted.map((p) => p.id);
      expect(ids).toEqual(modelOrder(spec));
      expect(ids).toEqual(scene.renderOrderNodes().map((n) => n.id).filter((id) => !modelHidden(spec, indexOf(id))));
      for (const p of painted) {
        const want = clipsOf(spec, indexOf(p.id));
        expect(p.clips).toEqual(want);
        expect(LAYERS.filter((l) => layerOf(spec, l).visible)[p.layer]).toBe(spec.nodes[indexOf(p.id)]!.layer);
        if (want.length > 0) clipped++;
        if (want.length > 1) nested++;
      }
      if (ids.length < spec.nodes.length) skipped++;
    }), runs(RUNS));
    expect(clipped).toBeGreaterThan(50);
    expect(nested).toBeGreaterThan(3);
    expect(skipped).toBeGreaterThan(30);
  }, timeoutFor(RUNS, 10));

  it('a build for one layer is the full build’s group for it', () => {
    let some = 0;
    fc.assert(fc.property(sceneSpec, fc.constantFrom(...LAYERS), (spec, layer) => {
      const adapter = sceneToAdapter(buildScene(spec)) as never;
      const full = buildSceneTree(adapter, draw as never, VIEW);
      const one = buildSceneTree(adapter, draw as never, VIEW, layer);
      const shown = LAYERS.filter((l) => layerOf(spec, l).visible);
      expect(one).toEqual(shown.includes(layer) ? [full[shown.indexOf(layer)]] : []);
      if (flatten(one).length > 0) some++;
    }), runs(RUNS));
    expect(some).toBeGreaterThan(50);
  }, timeoutFor(RUNS, 10));

  it('a culled node paints nothing and changes nothing else', () => {
    let culledSome = 0;
    fc.assert(fc.property(sceneSpec, fc.func(fc.boolean()), (spec, cullOf) => {
      const adapter = sceneToAdapter(buildScene(spec)) as never;
      const culled = (node: { id: string }) => cullOf(node.id);
      const calls: string[] = [];
      const counted = (node: { id: string }, pose: Box) => { calls.push(node.id); return draw(node, pose); };
      const full = flatten(buildSceneTree(adapter, draw as never, VIEW));
      const kept = flatten(buildSceneTree(adapter, counted as never, VIEW, undefined, undefined, culled as never));
      expect(kept).toEqual(full.filter((p) => !culled(p)));
      expect([...calls].sort()).toEqual(kept.map((p) => p.id).sort());
      if (kept.length < full.length && kept.length > 0) culledSome++;
    }), runs(RUNS));
    expect(culledSome).toBeGreaterThan(30);
  }, timeoutFor(RUNS, 10));
});
