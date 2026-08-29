import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from './types';
import { nodeMemo } from './nodeMemo';
import { PATH_L, PATH_M, type PolygonPath } from '../geometry/path';

const LAYERS = [{ id: 'main' as const }];

/** A derive that draws a line between the centers of its two dependencies. */
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

const registry = { derive: { 'test:connect': connectCenters } };

describe('derived geometry — serialization', () => {
  it('round-trips dependsOn and the derive registry key', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });

    const json = scene.toJSON();
    const node = json.nodes.find((n) => n.id === edge)!;
    expect(node.dependsOn).toEqual([a, b]);
    expect(node.deriveKey).toBe('test:connect');

    // sceneFromJSON reads systemLayers out of the JSON — it takes no such option.
    const restored = sceneFromJSON(json, { registry });
    const live = restored.get(asNodeId(edge))!;
    expect(live.dependsOn).toEqual([a, b]);
    expect(live.derive).toBe(connectCenters);
  });

  it('a node with no dependsOn serializes without the fields', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const json = scene.toJSON();
    expect(json.nodes[0]!.dependsOn).toBeUndefined();
    expect(json.nodes[0]!.deriveKey).toBeUndefined();
  });

  it('keeps derive attached across undo then redo', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    scene.undo();
    scene.redo();
    // kit:add replays without the spec — without a redo cache this is undefined.
    expect(scene.get(asNodeId(edge))!.derive).toBe(connectCenters);
  });

  it('warns rather than throwing when a derive key is missing at replay', () => {
    // The redo cache makes site 4's registry lookup unreachable in-process, so
    // this goes through a serialized history restored into a registry-less scene.
    const a = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const dep = a.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    a.add({
      id: asNodeId('edge'), kind: 'leaf', layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [dep], derive: connectCenters,
    });
    a.undo();   // head state: the edge is absent; its add entry carries the deriveKey
    const snap = a.serializeHistory();

    const b = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry: {} });
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(() => b.redo()).not.toThrow();
    const node = b.get(asNodeId('edge'))!;
    expect(node.dependsOn).toEqual([dep]);
    expect(node.derive).toBeUndefined();
  });

  it('throws from toJSON when derive is not in the registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a], derive: () => null,   // never registered
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });
});

/** The test-only cache-size hook, mirroring `__clipCacheSize`. */
function deriveCacheSize(scene: unknown): number {
  return (scene as { __deriveCacheSize: () => number }).__deriveCacheSize();
}

describe('derived geometry — redo-cache pruning', () => {
  it('prunes the cache entry when undo-stack overflow evicts a kit:add for a removed node', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: LAYERS, registry, historyLimit: 2,
    });
    const dep = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [dep], derive: connectCenters,
    });
    scene.remove(edge);
    expect(deriveCacheSize(scene)).toBe(1);

    // Two more ops push kit:add(edge) off the undo stack (limit=2). The node is
    // absent from state.nodes, so the entry is unreachable and must be pruned.
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    expect(deriveCacheSize(scene)).toBe(0);
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
          dependsOn: [asNodeId('a')], derive: connectCenters,
        },
      ],
    });
    expect(scene.get(asNodeId('edge'))!.derive).toBe(connectCenters);
    expect(deriveCacheSize(scene)).toBe(0);

    // kit:remove's revert clones the node, so undo restores derive without the cache.
    scene.remove(asNodeId('edge'));
    scene.undo();
    expect(scene.get(asNodeId('edge'))!.derive).toBe(connectCenters);
    expect(deriveCacheSize(scene)).toBe(0);
  });
});

describe('derived geometry — invalidation', () => {
  function setup() {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    return { scene, a, b, edge };
  }

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
      dependsOn: [edge], derive: connectCenters,
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

  /** Nothing depends on `box`, but it moves `a`'s world pose — which is what
   *  `derive` reads under a non-identity pose composition. */
  function setupNested() {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const box = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
    const a = scene.add({ kind: 'leaf', parent: box, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    return { scene, box, a, b, edge };
  }

  /** `dependsOn` is unvalidated and `derive` hands `undefined` to a dependency
   *  that isn't there, so naming an id that does not exist yet is legal. */
  function setupLateDependency() {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const later = asNodeId('later');
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [later, b], derive: connectCenters,
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
