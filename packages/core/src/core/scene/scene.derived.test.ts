import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from './types';
import { nodeMemo } from './nodeMemo';
import { PATH_L, PATH_M, type PolygonPath } from '../geometry/path';

const LAYERS = [{ id: 'main' as const }];

/** A derivePath that draws a line between the centers of its two dependencies. */
const connectCenters = (_node: unknown, deps: readonly (RectPose | undefined)[]): PolygonPath | null => {
  const [from, to] = deps;
  if (!from || !to) return null;
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([
      from.x + from.width / 2, from.y + from.height / 2,
      to.x + to.width / 2, to.y + to.height / 2,
    ]),
    fillRule: 'nonzero',
  };
};

const registry = { derivePath: { 'test:connect': connectCenters } };

function setup() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
  const edge = scene.add({
    kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
    dependsOn: [a, b], derivePath: connectCenters,
  });
  return { scene, a, b, edge };
}

/** Nothing depends on `box`, but it moves `a`'s world pose — which is what
 *  `derivePath` reads under a non-identity pose composition. */
function setupNested() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
  const box = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
  const a = scene.add({ kind: 'leaf', parent: box, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
  const edge = scene.add({
    kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
    dependsOn: [a, b], derivePath: connectCenters,
  });
  return { scene, box, a, b, edge };
}

describe('derived geometry — serialization', () => {
  it('round-trips dependsOn and the derivePath registry key', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derivePath: connectCenters,
    });

    const json = scene.toJSON();
    const node = json.nodes.find((n) => n.id === edge)!;
    expect(node.dependsOn).toEqual([a, b]);
    expect(node.derivePathKey).toBe('test:connect');

    // sceneFromJSON reads systemLayers out of the JSON — it takes no such option.
    const restored = sceneFromJSON(json, { registry });
    const live = restored.get(asNodeId(edge))!;
    expect(live.dependsOn).toEqual([a, b]);
    expect(live.derivePath).toBe(connectCenters);
  });

  it('a node with no dependsOn serializes without the fields', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const json = scene.toJSON();
    expect(json.nodes[0]!.dependsOn).toBeUndefined();
    expect(json.nodes[0]!.derivePathKey).toBeUndefined();
  });

  it('keeps derivePath attached across undo then redo', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derivePath: connectCenters,
    });
    scene.undo();
    scene.redo();
    // kit:add replays without the spec — without a redo cache this is undefined.
    expect(scene.get(asNodeId(edge))!.derivePath).toBe(connectCenters);
  });

  it('warns rather than throwing when a derivePath key is missing at replay', () => {
    // The redo cache makes site 4's registry lookup unreachable in-process, so
    // this goes through a serialized history restored into a registry-less scene.
    const a = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const dep = a.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    a.add({
      id: asNodeId('edge'), kind: 'leaf', layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [dep], derivePath: connectCenters,
    });
    a.undo();   // head state: the edge is absent; its add entry carries the derivePathKey
    const snap = a.serializeHistory();

    const b = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry: {} });
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(() => b.redo()).not.toThrow();
    const node = b.get(asNodeId('edge'))!;
    expect(node.dependsOn).toEqual([dep]);
    expect(node.derivePath).toBeUndefined();
  });

  it('throws from toJSON when derivePath is not in the registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a], derivePath: () => null,   // never registered
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });
});

/** The test-only cache-size hook, mirroring `__clipCacheSize`. */
function derivePathCacheSize(scene: unknown): number {
  return (scene as { __derivePathCacheSize: () => number }).__derivePathCacheSize();
}

describe('derived geometry — redo-cache pruning', () => {
  it('prunes the cache entry when undo-stack overflow evicts a kit:add for a removed node', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: LAYERS, registry, historyLimit: 2,
    });
    const dep = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [dep], derivePath: connectCenters,
    });
    scene.remove(edge);
    expect(derivePathCacheSize(scene)).toBe(1);

    // Two more ops push kit:add(edge) off the undo stack (limit=2). The node is
    // absent from state.nodes, so the entry is unreachable and must be pruned.
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(derivePathCacheSize(scene)).toBe(0);
  });

  it('never caches a construction-path node, whose kit:add is unloggable and so unprunable', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: LAYERS,
      registry,
      initial: [
        { id: asNodeId('a'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} },
        {
          id: asNodeId('edge'), kind: 'leaf', layer: 'main',
          pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
          dependsOn: [asNodeId('a')], derivePath: connectCenters,
        },
      ],
    });
    expect(scene.get(asNodeId('edge'))!.derivePath).toBe(connectCenters);
    expect(derivePathCacheSize(scene)).toBe(0);

    // kit:remove's revert clones the node, so undo restores derivePath without the cache.
    scene.remove(asNodeId('edge'));
    scene.undo();
    expect(scene.get(asNodeId('edge'))!.derivePath).toBe(connectCenters);
    expect(derivePathCacheSize(scene)).toBe(0);
  });
});

describe('derived geometry — invalidation', () => {
  /** Memoize a counter against a node the way the paint path will, so a
   *  surviving cache entry is observable as a call that did not happen. */
  function derivedCount(
    scene: Scene<object, 'main', RectPose>,
    id: NodeId,
    counter: { n: number },
  ): number {
    const node = scene.get(id)!;
    return nodeMemo(node, 'test:derived', node.pose, () => ++counter.n);
  }

  it('drops the dependent memo when a dependency pose is set', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);           // cached, as it should be

    scene.setPose(a, { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);           // dependency moved -> recomputed
  });

  it('drops the dependent memo when a dependency pose OVERRIDE commits', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    scene.overrides.set(a, { pose: { x: 0, y: 0, width: 10, height: 10 } });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    // This is what a drag does: mutate the entry's own pose buffer, then
    // commit. The pose REFERENCE never changes, so `set`'s invalidation is not
    // in play and a reference-keyed memo cannot see the move.
    scene.overrides.get(a)!.pose!.x = 50;
    scene.overrides.commit();

    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates transitively — a label on an edge on a node', () => {
    const { scene, a, edge } = setup();
    const label = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [edge], derivePath: connectCenters,
    });
    const counter = { n: 0 };
    derivedCount(scene, label, counter);
    expect(counter.n).toBe(1);

    scene.setPose(a, { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, label, counter);
    expect(counter.n).toBe(2);
  });

  it("restores a removed dependent's links when the removal is undone", () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    // kit:remove's apply detaches the edge's own declarations; only its revert
    // re-declares them, and the restored node is a clone with a fresh memo.
    scene.remove(edge);
    scene.undo();
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.setPose(a, { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  /** `dependsOn` is unvalidated and `derivePath` hands `undefined` to a dependency
   *  that isn't there, so naming an id that does not exist yet is legal. */
  function setupLateDependency() {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const later = asNodeId('later');
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [later, b], derivePath: connectCenters,
    });
    const addLater = () => scene.add({
      id: later, kind: 'leaf', layer: 'main',
      pose: { x: 0, y: 0, width: 10, height: 10 }, data: {},
    });
    return { scene, edge, addLater };
  }

  it('invalidates when a declared-but-absent dependency appears', () => {
    const { scene, edge, addLater } = setupLateDependency();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    addLater();
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates when a dependency vanishes on undo of its add', () => {
    const { scene, edge, addLater } = setupLateDependency();
    addLater();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.undo();
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates when an ancestor of a dependency is posed', () => {
    const { scene, box, edge } = setupNested();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.setPose(box, { x: 50, y: 0, width: 100, height: 100 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates when an ancestor of a dependency is OVERRIDE-dragged', () => {
    const { scene, box, edge } = setupNested();
    const counter = { n: 0 };
    scene.overrides.set(box, { pose: { x: 0, y: 0, width: 100, height: 100 } });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.overrides.get(box)!.pose!.x = 50;
    scene.overrides.commit();

    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates when an ancestor of a dependency is reparented', () => {
    const { scene, box, edge } = setupNested();
    const outer = scene.add({ kind: 'container', layer: 'main', pose: { x: 50, y: 0, width: 200, height: 200 }, data: {} });
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    // No pose is written at all — the frame `a` resolves against is what moved.
    scene.move(box, outer, 0);
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('undo of a dependency move also invalidates dependents', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    scene.setPose(a, { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.undo();
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });
});

describe('derived geometry — cascade delete', () => {
  const leaf = { kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} } as const;

  /** Houses the edge under a container with a sibling on each side, so a
   *  re-attach at the wrong index is visible rather than incidentally right. */
  function setupHoused() {
    const { scene, a, b, edge } = setup();
    const box = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
    const before = scene.add({ ...leaf, parent: box });
    const after = scene.add({ ...leaf, parent: box });
    scene.move(edge, box, 1);
    return { scene, a, b, edge, box, before, after };
  }

  it('removes dependents along with the node they depend on', () => {
    const { scene, a, b, edge } = setup();
    scene.remove(a);
    expect(scene.get(a)).toBeUndefined();
    expect(scene.get(edge)).toBeUndefined();
    expect(scene.get(b)).toBeDefined();
  });

  it('is a single undo entry — one undo restores both, one redo removes both', () => {
    const { scene, a, edge } = setup();
    scene.remove(a);
    scene.undo();
    expect(scene.get(a)).toBeDefined();
    expect(scene.get(edge)).toBeDefined();
    scene.redo();
    expect(scene.get(a)).toBeUndefined();
    expect(scene.get(edge)).toBeUndefined();
  });

  it('cascades transitively to a label on the edge', () => {
    const { scene, a, edge } = setup();
    const label = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [edge], derivePath: connectCenters,
    });
    scene.remove(a);
    expect(scene.get(label)).toBeUndefined();
  });

  it("cascades to a dependent of a removed container's descendant", () => {
    const { scene, box, a, edge } = setupNested();
    scene.remove(box);
    expect(scene.get(a)).toBeUndefined();
    expect(scene.get(edge)).toBeUndefined();
    scene.undo();
    expect(scene.get(edge)).toBeDefined();
  });

  it('restores a cascaded node with its dependsOn and derivePath intact', () => {
    const { scene, a, b, edge } = setup();
    scene.remove(a);
    expect(scene.get(edge)).toBeUndefined();   // else the assertions below read the original
    scene.undo();
    const live = scene.get(edge)!;
    expect(live.dependsOn).toHaveLength(2);
    expect(live.dependsOn).toEqual([a, b]);
    expect(live.derivePath).toBe(connectCenters);
  });

  it('unlinks a cascaded root from the root list, and restores its order', () => {
    const { scene, a, b, edge } = setup();
    scene.remove(a);
    expect(scene.roots).toEqual([b]);
    scene.undo();
    expect(scene.roots).toEqual([a, b, edge]);
  });

  it("unlinks a cascaded dependent from its parent's children", () => {
    const { scene, a, box, before, after } = setupHoused();
    scene.remove(a);
    expect(scene.childrenOf(box)).toEqual([before, after]);
  });

  it('restores a cascaded dependent at its original index among its siblings', () => {
    const { scene, a, edge, box, before, after } = setupHoused();
    scene.remove(a);
    expect(scene.get(edge)).toBeUndefined();   // else it never left the index it is checked at
    scene.undo();
    expect(scene.childrenOf(box)).toEqual([before, edge, after]);
  });

  it('restores two cascaded siblings at their own indices', () => {
    const { scene, a, b } = setup();
    const box = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
    const s0 = scene.add({ ...leaf, parent: box });
    const e1 = scene.add({ ...leaf, parent: box, dependsOn: [a, b], derivePath: connectCenters });
    const s2 = scene.add({ ...leaf, parent: box });
    const e3 = scene.add({ ...leaf, parent: box, dependsOn: [a, b], derivePath: connectCenters });
    const s4 = scene.add({ ...leaf, parent: box });

    scene.remove(a);
    expect(scene.childrenOf(box)).toEqual([s0, s2, s4]);
    scene.undo();
    expect(scene.childrenOf(box)).toEqual([s0, e1, s2, e3, s4]);
  });

  it("takes a cascaded dependent's own children with it", () => {
    const { scene, a, b } = setup();
    const group = scene.add({
      kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {},
      dependsOn: [a, b], derivePath: connectCenters,
    });
    const child = scene.add({ ...leaf, parent: group });

    scene.remove(a);
    expect(scene.get(group)).toBeUndefined();
    expect(scene.get(child)).toBeUndefined();
    scene.undo();
    expect(scene.childrenOf(group)).toEqual([child]);
  });

  it('clears the pose override of a cascaded node', () => {
    const { scene, a, edge } = setup();
    scene.overrides.set(edge, { pose: { x: 7, y: 7, width: 1, height: 1 } });
    scene.remove(a);
    expect(scene.overrides.get(edge)).toBeUndefined();
  });

  it('terminates on a dependency cycle', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const edge = asNodeId('edge');
    const a = scene.add({ ...leaf, dependsOn: [edge], derivePath: connectCenters });
    scene.add({ ...leaf, id: edge, dependsOn: [a], derivePath: connectCenters });

    scene.remove(a);
    expect(scene.roots).toEqual([]);
  });

  it('absorbs an id that another id in a removeMany already cascades away', () => {
    const { scene, a, b, edge } = setup();
    // The ordinary Cmd+A shape: the selection names both the node and its edge.
    expect(() => scene.removeMany([a, edge])).not.toThrow();
    expect(scene.roots).toEqual([b]);
    scene.undo();
    expect(scene.roots).toEqual([a, b, edge]);
  });

  it('removes a dependent on a surviving layer when its dependency\'s layer is dropped', () => {
    const scene = createScene<object, 'main' | 'base' | 'notes', RectPose>({
      systemLayers: [{ id: 'main' as const }],
      registry,
    });
    scene.addLayer({ id: 'base', name: 'Base' });
    scene.addLayer({ id: 'notes', name: 'Notes' });
    const a = scene.add({ ...leaf, layer: 'base' });
    const label = scene.add({
      ...leaf, layer: 'notes', dependsOn: [a], derivePath: connectCenters,
    });

    scene.removeLayer('base');
    expect(scene.get(a)).toBeUndefined();
    // `label` is tagged to a layer that still exists; it goes because `a` did.
    expect(scene.get(label)).toBeUndefined();
  });

  it('restores a node that cascaded through its own parent without duplicating it', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add(leaf);
    // A container deriving from its own child. The removed node is a descendant
    // of the node that cascades, so the tree loses the parent, not the child.
    const box = scene.add({
      kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {},
      dependsOn: [a], derivePath: connectCenters,
    });
    scene.move(a, box, 0);

    scene.remove(a);
    expect(scene.get(box)).toBeUndefined();
    expect(scene.roots).toEqual([]);
    scene.undo();
    expect(scene.roots).toEqual([box]);
    expect(scene.childrenOf(box)).toEqual([a]);
  });
});
