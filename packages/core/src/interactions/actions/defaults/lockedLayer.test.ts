/**
 * No kit action edits a node on a locked layer, even when a selection store
 * the scene does not own still holds it.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { deleteAction } from './delete';
import { nudgeRightAction } from './nudge';
import { groupAction, ungroupAction } from './group';
import { reorderForwardAction } from './reorder';
import type { Action } from '../action';

type Layer = 'base' | 'art';
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function fixture() {
  const scene = createScene<Record<string, never>, Layer>({
    systemLayers: [{ id: 'base' }, { id: 'art' }],
  });
  const free = scene.add({ kind: 'leaf', id: asNodeId('free'), layer: 'base', pose: POSE, data: {} });
  const box = scene.add({ kind: 'container', id: asNodeId('box'), layer: 'art', pose: POSE, data: {} });
  scene.add({ kind: 'leaf', id: asNodeId('kid'), layer: 'art', pose: POSE, data: {}, parent: box });
  const art = scene.add({ kind: 'leaf', id: asNodeId('art'), layer: 'art', pose: POSE, data: {} });
  scene.add({ kind: 'leaf', id: asNodeId('top'), layer: 'art', pose: POSE, data: {} });
  return { scene, free, box, art, top: asNodeId('top') };
}

/** A detached selection: what a view with its own store holds, which the
 *  scene cannot prune when a layer locks. */
const heldSelection = (ids: NodeId[]) => ({ get: () => ids, set: () => {}, current: ids });

const run = (action: Action, deps: Record<string, unknown>, params?: unknown): void =>
  (action.invoker as { run(deps: unknown, params?: unknown): void }).run(deps, params);

const snapshot = (scene: ReturnType<typeof fixture>['scene']) => JSON.stringify(scene.toJSON());

const cases: Array<[string, Action, (f: ReturnType<typeof fixture>) => NodeId[], unknown?]> = [
  ['delete', deleteAction, (f) => [f.free, f.art]],
  ['nudge', nudgeRightAction, (f) => [f.free, f.art]],
  ['reorder', reorderForwardAction, (f) => [f.art]],
  ['group', groupAction, (f) => [f.art, f.top]],
  ['ungroup', ungroupAction, (f) => [f.box]],
];

describe('kit actions on a locked layer', () => {
  it.each(cases)('%s edits the scene while the layer is unlocked', (_name, action, pick, params) => {
    const f = fixture();
    const before = snapshot(f.scene);
    run(action, { scene: f.scene, selection: heldSelection(pick(f)) }, params);
    expect(snapshot(f.scene)).not.toEqual(before);
  });

  it.each(cases)('%s refuses once the layer is locked and leaves nothing half-done', (_name, action, pick, params) => {
    const f = fixture();
    const ids = pick(f);
    f.scene.setLayerLocked('art', true);
    const before = snapshot(f.scene);
    const depth = f.scene.historyIndex();
    expect(() => run(action, { scene: f.scene, selection: heldSelection(ids) }, params)).toThrow(/locked/);
    expect(snapshot(f.scene)).toEqual(before);
    expect(f.scene.historyIndex()).toBe(depth);
  });
});
