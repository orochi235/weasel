/**
 * A scene's arrival handler sees every node that joins a container, whatever
 * edit brought it — an op batch, a scene batch, a bare add or move — and its
 * answer lands in the same undo step, or refuses the edit whole.
 */
import { describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import { SceneArrivalRefused } from './arrivals';
import { asNodeId, type NodeId, type SceneArrivalHandler } from './types';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { rebuildOp } from 'core/ops/registry';

type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const PLACED: Pose = { x: 100, y: 100, width: 10, height: 10 };

/** The adapter surface insert and reparent ops write through. */
function opAdapter(scene: ReturnType<typeof createScene<unknown, 'base', Pose>>) {
  return {
    getChildren: (parent: string | null) => [...(parent === null ? scene.roots : scene.childrenOf(asNodeId(parent)))],
    insertNode: (node: ReturnType<typeof leaf>, index?: number) => scene.add({ ...node, ...(index !== undefined ? { index } : {}) }),
    removeNode: (id: string) => scene.remove(asNodeId(id)),
    getNode: (id: string) => scene.get(asNodeId(id)),
    getRemovalClosure: (ids: readonly string[]) => [...scene.removalClosure(ids.map(asNodeId))],
    setParent: (id: string, parent: string | null) => scene.move(asNodeId(id), parent === null ? null : asNodeId(parent)),
    getParent: (id: string) => scene.get(asNodeId(id))?.parent ?? null,
    setPose: (id: string, pose: Pose) => scene.setPose(asNodeId(id), pose),
  };
}

function setup(handler: SceneArrivalHandler<Pose>) {
  const scene = createScene<unknown, 'base', Pose>({ systemLayers: [{ id: 'base' }] });
  const box = scene.add({ kind: 'container', id: asNodeId('box'), layer: 'base', pose: POSE, data: null });
  const loose = scene.add({ kind: 'leaf', id: asNodeId('loose'), layer: 'base', pose: POSE, data: null });
  const spy = vi.fn(handler);
  scene.setArrivalHandler(spy);
  const adapter = opAdapter(scene);
  return { scene, box, loose, spy, adapter };
}

const leaf = (id: string, parent: string | null) => ({
  kind: 'leaf' as const, id: asNodeId(id), layer: 'base' as const, pose: POSE, data: null, parent: parent === null ? null : asNodeId(parent),
});

const placeAll: SceneArrivalHandler<Pose> = (arrivals) => {
  const out = new Map<NodeId, Pose>();
  for (const ids of arrivals.values()) for (const id of ids) out.set(id, PLACED);
  return out;
};

describe('Scene — arrival handler', () => {
  it('places an inserted child as part of the insert, undone in one step', () => {
    const { scene, spy, adapter } = setup(placeAll);
    scene.applyBatch([createInsertOp({ node: leaf('kid', 'box') })], 'Insert', adapter);
    expect(spy).toHaveBeenCalledWith(new Map([[asNodeId('box'), [asNodeId('kid')]]]), new Set([asNodeId('box')]));
    expect(scene.get(asNodeId('kid'))?.pose).toEqual(PLACED);
    scene.undo();
    expect(scene.get(asNodeId('kid'))).toBeUndefined();
    scene.redo();
    expect(scene.get(asNodeId('kid'))?.pose).toEqual(PLACED);
    // Redo replays the arrangement it recorded rather than asking again.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('places a reparented child', () => {
    const { scene, adapter } = setup(placeAll);
    scene.applyBatch([createReparentOp({ id: 'loose', fromParentId: null, toParentId: 'box' })], 'Reparent', adapter);
    expect(scene.get(asNodeId('loose'))?.parent).toBe('box');
    expect(scene.get(asNodeId('loose'))?.pose).toEqual(PLACED);
    scene.undo();
    expect(scene.get(asNodeId('loose'))?.parent).toBeNull();
    expect(scene.get(asNodeId('loose'))?.pose).toEqual(POSE);
  });

  it('a refused op batch lands nothing, records nothing and does not throw', () => {
    const { scene, adapter } = setup(() => null);
    const depth = scene.historyIndex();
    expect(() => scene.applyBatch([
      createInsertOp({ node: leaf('kid', 'box') }),
      createReparentOp({ id: 'loose', fromParentId: null, toParentId: 'box' }),
    ], 'Insert', adapter)).not.toThrow();
    expect(scene.get(asNodeId('kid'))).toBeUndefined();
    expect(scene.get(asNodeId('loose'))?.parent).toBeNull();
    expect(scene.historyIndex()).toBe(depth);
  });

  it('a refused scene.batch reverts and throws SceneArrivalRefused', () => {
    const { scene } = setup(() => null);
    expect(() => scene.batch('Add', () => {
      scene.add(leaf('kid', 'box'));
      scene.setPose(asNodeId('loose'), PLACED);
    })).toThrow(SceneArrivalRefused);
    expect(scene.get(asNodeId('kid'))).toBeUndefined();
    expect(scene.get(asNodeId('loose'))?.pose).toEqual(POSE);
  });

  it('settles a bare add under a container as one undo step', () => {
    const { scene } = setup(placeAll);
    scene.add(leaf('kid', 'box'));
    expect(scene.get(asNodeId('kid'))?.pose).toEqual(PLACED);
    scene.undo();
    expect(scene.get(asNodeId('kid'))).toBeUndefined();
  });

  it('settles a bare move into a container, and throws when refused', () => {
    const placed = setup(placeAll);
    placed.scene.move(asNodeId('loose'), asNodeId('box'));
    expect(placed.scene.get(asNodeId('loose'))?.pose).toEqual(PLACED);

    const refused = setup(() => null);
    expect(() => refused.scene.move(asNodeId('loose'), asNodeId('box'))).toThrow(SceneArrivalRefused);
    expect(refused.scene.get(asNodeId('loose'))?.parent).toBeNull();
  });

  it('a reorder among siblings is a change, not an arrival', () => {
    const { scene, spy } = setup(placeAll);
    scene.add(leaf('a', 'box'));
    scene.add(leaf('b', 'box'));
    spy.mockClear();
    scene.move(asNodeId('b'), asNodeId('box'), 0);
    expect(spy).toHaveBeenCalledWith(new Map(), new Set([asNodeId('box')]));
  });

  it('reports only nodes still in the container when the edit ends', () => {
    const { scene, spy, adapter } = setup(placeAll);
    scene.applyBatch([
      createReparentOp({ id: 'loose', fromParentId: null, toParentId: 'box' }),
      createReparentOp({ id: 'loose', fromParentId: 'box', toParentId: null }),
    ], 'Through', adapter);
    expect(spy).toHaveBeenCalledWith(new Map(), new Set([asNodeId('box')]));
  });

  it('a removed handler no longer runs, and a stale disposer leaves its successor', () => {
    const scene = createScene<unknown, 'base', Pose>({ systemLayers: [{ id: 'base' }] });
    scene.add({ kind: 'container', id: asNodeId('box'), layer: 'base', pose: POSE, data: null });
    const first = vi.fn(placeAll);
    const second = vi.fn(placeAll);
    const disposeFirst = scene.setArrivalHandler(first);
    scene.setArrivalHandler(second);
    disposeFirst();
    scene.add(leaf('kid', 'box'));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('the arrangement op rebuilds from its serialized form', () => {
    const { scene, adapter } = setup(placeAll);
    scene.applyBatch([createInsertOp({ node: leaf('kid', 'box') })], 'Insert', adapter);
    const snapshot = scene.serializeHistory();
    const entry = snapshot.undoStack[snapshot.undoStack.length - 1];
    const arrange = entry.baseOps.find((o) => o.name === 'arrange')!;
    const rebuilt = rebuildOp(arrange.name, arrange.args)!;
    const writes: [string, unknown][] = [];
    rebuilt.invert().apply({ setPose: (id: string, pose: unknown) => writes.push([id, pose]) });
    expect(writes).toEqual([['kid', POSE]]);
  });
});
