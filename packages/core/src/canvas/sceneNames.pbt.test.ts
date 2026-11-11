/**
 * Property tests of picking and painting a scene whose layers and nodes are named `__proto__`, `toString`,
 * `constructor`, and the other names a plain object answers for: renamed, the scene picks and paints exactly
 * what the same scene under plain names does, node for node, on parallax planes too.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DrawCommand } from '@weasel-js/renderer';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { pickWalk, scenePickSource, type PickQuery } from './pickWalk';
import { pointPick, regionPick } from './pickIndex/pickIndexFixture';
import { sceneToAdapter } from './sceneAdapter';
import {
  LAYERS, buildScene, intBox, nodeIdOf, protoNames, runs, sceneSpec, timeoutFor, type Box, type BoxScene, type SceneNames,
} from './pbt.fixture';

const RUNS = 200;
const d = AUTO_POSE_DESCRIPTOR;
const CAMERA: View = { x: 30, y: -10, scale: { x: 2, y: 2 } };

/** Each name back to the node's index, so the two scenes' answers compare. */
const indexer = (names: SceneNames, count: number) => {
  const of = new Map(Array.from({ length: count }, (_, i) => [(names.node ?? nodeIdOf)(i) as string, i]));
  return (ids: readonly string[]) => ids.map((id) => of.get(id));
};

function sceneFor(spec: Parameters<typeof buildScene>[0], names: SceneNames, plane: number | null): BoxScene {
  const scene = buildScene(spec, 0, 0, names);
  if (plane !== null) scene.setLayerParallax((names.layer ?? ((l) => l))(LAYERS[plane]!) as never, { pan: 0.5, anchor: { x: 7, y: 3 } });
  return scene;
}

const walk = (scene: BoxScene, q: PickQuery<unknown>, indexed: boolean): string[] =>
  pickWalk(scenePickSource(scene as never, { camera: CAMERA, ...(indexed ? { index: { descriptor: d } } : {}) }), q);

const draw = (node: { id: string }, pose: Box): DrawCommand[] =>
  [{ kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: node.id } } } as DrawCommand];

function painted(out: readonly DrawCommand[]): string[] {
  const found: string[] = [];
  const visit = (c: DrawCommand): void => {
    if (c.kind === 'group') (c as { children: DrawCommand[] }).children.forEach(visit);
    else if (c.kind === 'path') found.push((c as { fill: { paint: { color: string } } }).fill.paint.color);
  };
  out.forEach(visit);
  return found;
}

describe('a scene named like a plain object’s own fields', () => {
  it('picks and paints what the same scene under plain names does', () => {
    let hit = 0, shown = 0;
    const half = fc.integer({ min: 0, max: 200 }).map((n) => n + 0.5);
    fc.assert(fc.property(sceneSpec, fc.option(fc.integer({ min: 0, max: 2 }), { nil: null }), half, half, intBox, (spec, plane, x, y, m) => {
      const plain = sceneFor(spec, {}, plane);
      const odd = sceneFor(spec, protoNames, plane);
      const asPlain = indexer({}, spec.nodes.length), asOdd = indexer(protoNames, spec.nodes.length);
      expect(asOdd(odd.renderOrderNodes().map((n) => n.id))).toEqual(asPlain(plain.renderOrderNodes().map((n) => n.id)));
      const queries = [pointPick(d, x, y, { x: 2, y: 2 }), regionPick(rectRegion(m), 'intersect', d, true), regionPick(rectRegion(m), 'enclosed', d)];
      for (const q of queries) {
        for (const indexed of [false, true]) {
          const want = asPlain(walk(plain, q, indexed));
          expect(asOdd(walk(odd, q, indexed))).toEqual(want);
          if (want.length > 0) hit++;
        }
      }
      const paints = asPlain(painted(buildSceneTree(sceneToAdapter(plain) as never, draw as never, CAMERA)));
      expect(asOdd(painted(buildSceneTree(sceneToAdapter(odd) as never, draw as never, CAMERA)))).toEqual(paints);
      if (paints.length > 0) shown++;
    }), runs(RUNS));
    expect(hit).toBeGreaterThan(100);
    expect(shown).toBeGreaterThan(100);
  }, timeoutFor(RUNS, 40));
});
