/**
 * `moveNodes` moves ids the way a drag of them commits: the same ops, under an
 * upright frame and a turned one.
 */
import { describe, expect, it } from 'vitest';
import type { ActionDeps, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { makeFrameFixture, FRAME_FIXTURE_IDS } from 'core/scene/frameFixture';
import type { Op } from 'core/ops/types';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { moveAction } from './move/action';
import { moveNodes, moveNodesOps, MOVE_NODES_REQUIRES } from './moveNodes';
import * as Barrel from '../../index';

type AnyScene = Scene<unknown, string, unknown>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

const selectionOf = (ids: readonly string[]) => ({ get: () => ids } as unknown as SelectionApi);

/** A container holding a leaf stored in its frame, and a leaf outside it. */
function upright(): { scene: AnyScene; group: NodeId; child: NodeId; free: NodeId } {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 100, 60, 60) });
  const child = scene.add({ kind: 'mark', parent: group, layer: 'main', data: {}, pose: box(10, 10) });
  const free = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(200, 0) });
  return { scene: scene as unknown as AnyScene, group, child, free };
}

/** Drag `ids` by `(dx, dy)` through the move action and release. */
function drag(scene: AnyScene, ids: readonly string[], dx: number, dy: number): void {
  const ctx = (current?: { x: number; y: number }): InvocationCtx => ({
    world: current ?? { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: selectionOf(ids), scene },
    drag: current ? { start: { x: 0, y: 0 }, current, delta: current } : undefined,
  } as unknown as InvocationCtx);
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(), undefined) as OngoingHandle;
  handle.onMove!(ctx({ x: dx, y: dy }));
  handle.onEnd!(ctx({ x: dx, y: dy }), 'commit');
}

const depsOf = (scene: AnyScene) => ({ scene }) as unknown as ActionDeps;

/** Every pose in render order: two scenes built alike mint different ids. */
const posesOf = (scene: AnyScene) => [...scene.renderOrder()].map((id) => scene.get(id)!.pose);

describe('moveNodes', () => {
  it('moves a container, which carries the child stored in its frame, and nothing else', () => {
    const { scene, group, child, free } = upright();
    expect(moveNodes(depsOf(scene), [group], { dx: 30, dy: -5 })).toBe(true);
    expect(scene.get(group)!.pose).toEqual(box(30, 95, 60, 60));
    expect(scene.get(child)!.pose).toEqual(box(10, 10));
    expect(scene.get(free)!.pose).toEqual(box(200, 0));
  });

  it.each([
    ['an upright container and its child', () => { const f = upright(); return { scene: f.scene, ids: [f.group, f.free] }; }],
    ['a turned frame', () => ({ scene: makeFrameFixture() as unknown as AnyScene, ids: [FRAME_FIXTURE_IDS.group] }) ],
    ['a leaf stored in a turned frame', () => ({ scene: makeFrameFixture() as unknown as AnyScene, ids: [FRAME_FIXTURE_IDS.turned] }) ],
  ])('writes what a drag commits: %s', (_name, make) => {
    const dragged = make();
    const moved = make();
    drag(dragged.scene, dragged.ids, 25, 40);
    moveNodes(depsOf(moved.scene), moved.ids, { dx: 25, dy: 40 });
    expect(posesOf(moved.scene)).toEqual(posesOf(dragged.scene));
  });

  it('is one undo entry, and joins an open batch rather than making its own', () => {
    const { scene, group } = upright();
    let added: NodeId | null = null;
    scene.batch('Drop', () => {
      added = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
      moveNodes(depsOf(scene), [added], { dx: 5, dy: 5 });
      moveNodes(depsOf(scene), [group], { dx: 5, dy: 5 });
    });
    expect(scene.get(added!)!.pose).toEqual(box(5, 5));
    expect(scene.historyEntries().at(-1)!.label).toBe('Drop');
    scene.undo();
    expect(scene.get(added!)).toBeUndefined();
    expect(scene.get(group)!.pose).toEqual(box(0, 100, 60, 60));
  });

  it('commits through applyOps, finished by every transform follower', () => {
    const { scene, free } = upright();
    const seen: string[] = [];
    let committed: { ops: Op[]; label: string } | null = null;
    const deps = {
      scene,
      applyOps: (ops: Op[], label: string) => { committed = { ops, label }; },
      transformFollowers: [{
        preview: () => [],
        finish: (ops: readonly Op[], label: string) => { seen.push(label); return [...ops]; },
      }],
    } as unknown as ActionDeps;
    expect(moveNodes(deps, [free], { dx: 1, dy: 0 }, 'Drop')).toBe(true);
    expect(seen).toEqual(['Drop']);
    expect(committed!.label).toBe('Drop');
    expect(committed!.ops).toHaveLength(1);
  });

  it('commits nothing when a follower refuses, or for a zero delta', () => {
    const { scene, free } = upright();
    const before = scene.historyEntries().length;
    const refuse = { scene, transformFollowers: [{ preview: () => [], finish: () => null }] } as unknown as ActionDeps;
    expect(moveNodes(refuse, [free], { dx: 1, dy: 0 })).toBe(false);
    expect(moveNodes(depsOf(scene), [free], { dx: 0, dy: 0 })).toBe(false);
    expect(scene.get(free)!.pose).toEqual(box(200, 0));
    expect(scene.historyEntries()).toHaveLength(before);
  });

  it('builds the ops without committing them', () => {
    const { scene, group } = upright();
    expect(moveNodesOps(scene, [group], { dx: 1, dy: 1 })).toHaveLength(1);
    expect(scene.get(group)!.pose).toEqual(box(0, 100, 60, 60));
  });

  it('names every dep it reads, and is exported by name from the barrel', () => {
    expect([...MOVE_NODES_REQUIRES].sort()).toEqual(
      ['applyOps', 'geometryProjection', 'poseDescriptor', 'scene', 'selection', 'transformFollowers'],
    );
    expect(Barrel.moveNodes).toBe(moveNodes);
    expect(Barrel.moveNodesOps).toBe(moveNodesOps);
    expect(Barrel.MOVE_NODES_REQUIRES).toBe(MOVE_NODES_REQUIRES);
  });
});
