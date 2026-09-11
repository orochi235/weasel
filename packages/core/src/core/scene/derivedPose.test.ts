import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { documentPose, effectivePose } from './effectivePose';
import { UNION_OF_CHILDREN, unionOfChildren, unionOfChildrenVia } from './kitRegistry';
import {
  circle,
  CIRCLE_POSE_DESCRIPTOR,
  type CirclePose,
} from 'interactions/actions/resize/circlePose.fixture';
import { asNodeId, type NodeId, type RectPose } from './types';

const LAYERS = [{ id: 'main' as const }];

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose =>
  ({ x, y, width: w, height: h });

/** Where the scene says `id` is, resolving overrides and derivation. */
const poseOf = (scene: S, id: NodeId): RectPose => effectivePose(scene, scene.get(id)!);

/** A group whose pose is the envelope of its two members. */
function grouped() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const g = scene.add({
    kind: 'container', layer: 'main', pose: box(0, 0, 0, 0), data: {},
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  const a = scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: box(0, 0), data: {} });
  const b = scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: box(90, 40), data: {} });
  return { scene, g, a, b };
}

describe('derived pose — a container that hugs its children', () => {
  it('reports the union of its members, not its authored pose', () => {
    const { scene, g } = grouped();
    expect(poseOf(scene, g)).toEqual(box(0, 0, 100, 50));
  });

  it('follows a member that moves', () => {
    const { scene, g, b } = grouped();
    scene.setPose(b, box(190, 40));
    expect(poseOf(scene, g)).toEqual(box(0, 0, 200, 50));
  });

  it('follows the undo of that move', () => {
    const { scene, g, b } = grouped();
    scene.setPose(b, box(190, 40));
    scene.undo();
    expect(poseOf(scene, g)).toEqual(box(0, 0, 100, 50));
  });

  it('follows a member added later', () => {
    const { scene, g } = grouped();
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: box(200, 0), data: {} });
    expect(poseOf(scene, g)).toEqual(box(0, 0, 210, 50));
  });

  it('follows a member removed', () => {
    const { scene, g, b } = grouped();
    scene.remove(b);
    expect(poseOf(scene, g)).toEqual(box(0, 0, 10, 10));
  });

  it('follows a member reparented out', () => {
    const { scene, g, b } = grouped();
    scene.move(b, null);
    expect(poseOf(scene, g)).toEqual(box(0, 0, 10, 10));
  });

  it('falls back to its authored pose once emptied', () => {
    const { scene, g, a, b } = grouped();
    scene.removeMany([a, b]);
    expect(poseOf(scene, g)).toEqual(box(0, 0, 0, 0));
  });

  it('outlives the members it derives from — deleting one is not a cascade', () => {
    const { scene, g, a } = grouped();
    scene.remove(a);
    expect(scene.get(g)).toBeDefined();
  });

  it('resolves bottom-up through a nested group', () => {
    const { scene, g, b } = grouped();
    const outer = scene.add({
      kind: 'container', layer: 'main', pose: box(0, 0, 0, 0), data: {},
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.move(g, outer);
    scene.setPose(b, box(290, 40));
    expect(poseOf(scene, outer)).toEqual(box(0, 0, 300, 50));
  });
});

describe('derived pose — precedence', () => {
  it('a pose override on the container wins over the derivation', () => {
    const { scene, g } = grouped();
    scene.overrides.set(g, { pose: box(500, 500, 1, 1) });
    expect(poseOf(scene, g)).toEqual(box(500, 500, 1, 1));
  });

  it("a member's override reaches the container the same frame", () => {
    const { scene, g, b } = grouped();
    scene.overrides.set(b, { pose: box(190, 40) });
    expect(poseOf(scene, g)).toEqual(box(0, 0, 200, 50));
  });

  it('documentPose ignores the override but keeps the derivation', () => {
    const { scene, g } = grouped();
    scene.overrides.set(g, { pose: box(500, 500, 1, 1) });
    expect(documentPose(scene, scene.get(g)!)).toEqual(box(0, 0, 100, 50));
  });

  it('a node with no derivePose is unaffected', () => {
    const { scene, a } = grouped();
    expect(poseOf(scene, a)).toEqual(box(0, 0));
  });
});

describe('derived pose — explicit dependencies', () => {
  /** A label sized to the envelope of the two nodes it annotates. */
  const spanOf = unionOfChildren<RectPose>;

  it('derives from the ids it names, in a scene with no containers', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: box(90, 0), data: {} });
    const label = scene.add({
      kind: 'leaf', layer: 'main', pose: box(0, 0, 0, 0), data: {},
      dependsOn: [a, b], derivePose: spanOf,
    });
    expect(poseOf(scene, label)).toEqual(box(0, 0, 100, 10));
    scene.setPose(b, box(190, 0));
    expect(poseOf(scene, label)).toEqual(box(0, 0, 200, 10));
  });

  it('terminates on a cycle, answering from the authored pose', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const x = asNodeId('x');
    const y = asNodeId('y');
    scene.add({
      kind: 'leaf', id: x, layer: 'main', pose: box(1, 1), data: {},
      dependsOn: [y], derivePose: spanOf,
    });
    scene.add({
      kind: 'leaf', id: y, layer: 'main', pose: box(2, 2), data: {},
      dependsOn: [x], derivePose: spanOf,
    });
    // Whichever node is asked first is the one that falls back where the cycle
    // closes, so both answer from its authored pose.
    expect(poseOf(scene, x)).toEqual(box(1, 1));
  });

  it('does not cache what a cycle produced', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const x = asNodeId('x');
    const y = asNodeId('y');
    scene.add({
      kind: 'leaf', id: x, layer: 'main', pose: box(1, 1), data: {},
      dependsOn: [y], derivePose: spanOf,
    });
    scene.add({
      kind: 'leaf', id: y, layer: 'main', pose: box(2, 2), data: {},
      dependsOn: [x], derivePose: spanOf,
    });
    poseOf(scene, x);
    // Asking y would serve x's answer if the cycle's result had been memoized.
    expect(poseOf(scene, y)).toEqual(box(2, 2));
  });
});

describe('derived pose — serialization', () => {
  it("round-trips dependsOn: 'children' and the derivePose registry key", () => {
    const { scene, g } = grouped();
    const json = JSON.parse(JSON.stringify(scene.toJSON()));
    const node = json.nodes.find((n: { id: string }) => n.id === (g as string));
    expect(node.dependsOn).toBe('children');
    expect(node.derivePoseKey).toBe(UNION_OF_CHILDREN);

    const reloaded = sceneFromJSON<object, 'main', RectPose>(json, {});
    expect(poseOf(reloaded as S, g)).toEqual(box(0, 0, 100, 50));
  });

  it('keeps derivePose attached across undo then redo of the container add', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} });
    const g = scene.add({
      kind: 'container', layer: 'main', pose: box(0, 0, 0, 0), data: {},
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.move(a, g);
    scene.undo();
    scene.undo();
    scene.redo();
    scene.redo();
    expect(scene.get(g)!.derivePose).toBe(unionOfChildren);
    expect(poseOf(scene, g)).toEqual(box(0, 0, 10, 10));
  });

  it("restores a removed container's derivePose when the removal is undone", () => {
    const { scene, g } = grouped();
    scene.remove(g);
    scene.undo();
    expect(scene.get(g)!.derivePose).toBe(unionOfChildren);
    expect(poseOf(scene, g)).toEqual(box(0, 0, 100, 50));
  });

  it('throws from toJSON when derivePose is not in the registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const g = scene.add({
      kind: 'container', layer: 'main', pose: box(0, 0, 0, 0), data: {},
      dependsOn: 'children', derivePose: () => null,   // never registered
    });
    expect(g).toBeDefined();
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });
});

describe('derived pose — non-rect poses', () => {
  it('unions circles through a descriptor', () => {
    const union = unionOfChildrenVia(CIRCLE_POSE_DESCRIPTOR);
    const scene = createScene<object, 'main', CirclePose>({
      systemLayers: LAYERS,
      registry: { derivePose: { [UNION_OF_CHILDREN]: union } },
    });
    const g = scene.add({
      kind: 'container', layer: 'main', pose: circle(0, 0, 0), data: {},
      dependsOn: 'children', derivePose: union,
    });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(0, 0, 10), data: {} });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(40, 0, 10), data: {} });
    expect(effectivePose(scene, scene.get(g)!)).toEqual(circle(20, 0, 10));
  });

  it('exposes the merged registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    expect(scene.registry.derivePose?.[UNION_OF_CHILDREN]).toBe(unionOfChildren);
  });
});
