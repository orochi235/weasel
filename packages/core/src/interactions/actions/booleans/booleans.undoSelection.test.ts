/**
 * Regression: undoing a boolean op must restore the selection that produced
 * it. Mirrors WeaselDraw's wiring — a scene-backed `BooleansAdapter` whose
 * `applyOps` commits through the scene — because the loss happens in the
 * commit path, not in `applyBooleanOp`.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { boundsOfPath } from 'features/paths/bounds';
import { pathInWorld } from 'features/paths/pathInWorld';
import type { Path } from 'features/paths/types';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { applyBooleanOp, type BooleansAdapter } from './booleans';

interface Data { path?: Path; fill?: string }
type Layer = 'default';
type Pose = { x: number; y: number; width: number; height: number };

/** `commit: 'batch'` is what WeaselDraw shipped — ops re-applied inside
 *  `scene.batch`, so only the scene's own mutations reach the entry.
 *  `commit: 'applyBatch'` hands the batch to the scene, ops and all. */
function setup(commit: 'batch' | 'applyBatch') {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  let nextId = 0;

  const adapter: BooleansAdapter = {
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids) => { scene.setSelection(ids); },
    getWorldPath: (id) => {
      const node = scene.get(asNodeId(id));
      if (!node || node.kind !== 'leaf' || !node.data.path) return undefined;
      return pathInWorld(node.data.path, node.pose);
    },
    compareZ: (a, b) => {
      const order = [...scene.renderOrder()];
      return order.indexOf(asNodeId(a)) - order.indexOf(asNodeId(b));
    },
    createPathNode: (path) => {
      const b = boundsOfPath(path);
      return {
        id: `b-${nextId++}`,
        kind: 'leaf',
        layer: 'default',
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: { path, fill: '#888' },
        parent: null,
      } as { id: string };
    },
    getNode: (id) => scene.get(asNodeId(id)) ?? undefined,
    getZOrder: (id) => {
      const order = [...scene.renderOrder()];
      const idx = order.indexOf(asNodeId(id));
      if (idx < 0) return undefined;
      return { parentId: scene.get(asNodeId(id))?.parent ?? null, index: idx };
    },
    insertNode: (node, index?: number) => {
      const n = node as { id: string; kind: 'leaf'; layer: Layer; pose: Pose; data: Data };
      scene.add({
        id: asNodeId(n.id),
        kind: n.kind,
        layer: n.layer,
        pose: n.pose,
        data: n.data,
        ...(index !== undefined ? { index } : {}),
      });
    },
    removeNode: (id) => { scene.remove(asNodeId(id)); },
    applyOps: (ops, label) => {
      if (commit === 'applyBatch') {
        scene.applyBatch(ops, label ?? 'Booleans', { ...defaultCommitAdapter(scene), ...adapter });
        return;
      }
      scene.batch(label ?? 'Booleans', () => {
        for (const op of ops) op.apply(adapter);
      });
    },
  };

  return {
    scene,
    adapter,
    sel: () => [...scene.getSelection()],
    select: (ids: string[]) => { scene.setSelection(ids.map(asNodeId)); },
  };
}

describe.each(['batch', 'applyBatch'] as const)('undo over a boolean op (%s commit)', (commit) => {
  it('restores the operand nodes', () => {
    const { scene, adapter, select } = setup(commit);
    scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 60, height: 60 }, data: { path: { kind: 'rect', x: 0, y: 0, width: 60, height: 60 } as Path } });
    scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'default', pose: { x: 40, y: 40, width: 60, height: 60 }, data: { path: { kind: 'rect', x: 0, y: 0, width: 60, height: 60 } as Path } });
    select(['a', 'b']);

    expect(applyBooleanOp(adapter, 'union').kind).toBe('applied');
    expect(scene.get(asNodeId('a'))).toBeUndefined();

    scene.undo();
    expect(scene.get(asNodeId('a'))).toBeDefined();
    expect(scene.get(asNodeId('b'))).toBeDefined();
  });

  it('restores the selection that produced it', () => {
    const { scene, adapter, sel, select } = setup(commit);
    scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 60, height: 60 }, data: { path: { kind: 'rect', x: 0, y: 0, width: 60, height: 60 } as Path } });
    scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'default', pose: { x: 40, y: 40, width: 60, height: 60 }, data: { path: { kind: 'rect', x: 0, y: 0, width: 60, height: 60 } as Path } });
    select(['a', 'b']);

    applyBooleanOp(adapter, 'union');
    expect(sel()).toHaveLength(1);

    scene.undo();
    expect(sel()).toEqual([asNodeId('a'), asNodeId('b')]);
  });
});
