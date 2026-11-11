/**
 * Property tests of `buildSceneTree`'s paint order under edits that move no node in the tree: poses (finite or
 * not, zero-size, huge, subnormal), override poses and alphas, locks, and data. The order stays as it was, and
 * hiding one node takes out exactly it and what it holds.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { sceneToAdapter } from './sceneAdapter';
import { buildScene, nodeIdOf, runs, sceneSpec, timeoutFor, type Box, type BoxScene } from './pbt.fixture';

const RUNS = 200;
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const draw = (node: { id: string }, pose: Box): DrawCommand[] =>
  [{ kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { kind: 'solid', color: node.id } } } as DrawCommand];

function painted(scene: BoxScene): string[] {
  const found: string[] = [];
  const visit = (c: DrawCommand): void => {
    if (c.kind === 'group') (c as { children: DrawCommand[] }).children.forEach(visit);
    else if (c.kind === 'path') found.push((c as { fill: { paint: { color: string } } }).fill.paint.color);
  };
  buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW).forEach(visit);
  return found;
}

const edge = fc.constantFrom(0, -0, 5e-324, -5e-324, 1e-300, 1e300, -1e300, 2 ** 53, Number.MAX_VALUE, Infinity, -Infinity, NaN);
const num = fc.oneof({ weight: 3, arbitrary: fc.integer({ min: -500, max: 500 }) }, { weight: 1, arbitrary: edge });
const box: fc.Arbitrary<Box> = fc.record({ x: num, y: num, width: num, height: num });

type Edit = { kind: 'pose' | 'override'; at: number; box: Box } | { kind: 'alpha'; at: number; alpha: number }
  | { kind: 'lock'; at: number; on: boolean } | { kind: 'data'; at: number };

const anEdit: fc.Arbitrary<Edit> = fc.oneof(
  fc.record({ kind: fc.constantFrom('pose' as const, 'override' as const), at: fc.nat(), box }),
  fc.record({ kind: fc.constant('alpha' as const), at: fc.nat(), alpha: fc.constantFrom(0.01, 0.5, 1, 2) }),
  fc.record({ kind: fc.constant('lock' as const), at: fc.nat(), on: fc.boolean() }),
  fc.record({ kind: fc.constant('data' as const), at: fc.nat() }),
);

function apply(scene: BoxScene, e: Edit, count: number): void {
  const id = nodeIdOf(e.at % count);
  scene.unlocked(() => {
    switch (e.kind) {
      case 'pose': scene.setPose(id, e.box); break;
      case 'override': scene.overrides.set(id, { pose: e.box }); scene.overrides.commit(); break;
      case 'alpha': scene.overrides.set(id, { alpha: e.alpha }); scene.overrides.commit(); break;
      case 'lock': scene.setLocked(id, e.on); break;
      case 'data': scene.update(id, { data: null }); break;
    }
  });
}

describe('buildSceneTree under edits in place', () => {
  it('paints in the order it did before', () => {
    let edits = 0;
    fc.assert(fc.property(sceneSpec, fc.array(anEdit, { minLength: 1, maxLength: 12 }), (spec, list) => {
      const scene = buildScene(spec);
      const before = painted(scene);
      for (const e of list) {
        apply(scene, e, spec.nodes.length);
        expect(painted(scene), JSON.stringify(e)).toEqual(before);
        edits++;
      }
    }), runs(RUNS));
    expect(edits).toBeGreaterThan(600);
  }, timeoutFor(RUNS, 30));

  it('hiding a node takes out it and what it holds, and nothing else', () => {
    let took = 0;
    fc.assert(fc.property(sceneSpec, fc.nat(), (spec, at) => {
      const scene = buildScene(spec);
      const i = at % spec.nodes.length;
      const before = painted(scene);
      const held = new Set<string>([nodeIdOf(i), ...descendants(scene, nodeIdOf(i))]);
      scene.unlocked(() => scene.setHidden(nodeIdOf(i), true));
      expect(painted(scene)).toEqual(before.filter((id) => !held.has(id)));
      scene.unlocked(() => scene.setHidden(nodeIdOf(i), spec.nodes[i]!.hidden));
      expect(painted(scene)).toEqual(before);
      if (before.some((id) => held.has(id))) took++;
    }), runs(RUNS));
    expect(took).toBeGreaterThan(60);
  }, timeoutFor(RUNS, 20));
});

function descendants(scene: BoxScene, id: string): string[] {
  return scene.childrenOf(id as never).flatMap((k) => [k as string, ...descendants(scene, k)]);
}
