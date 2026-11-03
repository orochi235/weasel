/** A move in a paged scene: a page's child dropped on another page, on the pasteboard, or off every page. */
import { describe, expect, it } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';
import { PAGE_A, PAGE_B, ON_PAGE, pagedScene } from 'core/pages/pagedFixture';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** Press on `id` at `from` and release `dx` to the right; `ON_PAGE` sits at world (90, 10) on page `a`. */
function drag(dx: number, options: {
  pasteboard?: boolean; id?: NodeId; from?: { x: number; y: number }; params?: Record<string, unknown>;
} = {}) {
  const { scene } = pagedScene({ pasteboard: options.pasteboard ?? false });
  const id = options.id ?? ON_PAGE;
  if (id !== ON_PAGE) scene.add({ id, kind: 'mark', layer: 'ink', pose: { x: 300, y: 10, width: 20, height: 10 }, data: {} });
  const from = options.from ?? { x: 95, y: 15 };
  const entries = scene.historyEntries().length;
  const base = { world: from, modifiers: MODS, deps: { selection: { get: () => [id] }, scene, nodeAtPoint: () => null } };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: options.params ?? {} } as BindingOpts);
  const to = { x: from.x + dx, y: from.y };
  const at = { ...base, world: to, drag: { start: from, current: to, delta: { x: dx, y: 0 } } } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  const node = scene.get(id)!;
  return { node, pose: node.pose as RectPose, undoSteps: scene.historyEntries().length - entries };
}

describe('moveAction in a paged scene', () => {
  it('moves a page\'s child dropped on another page into it, where it was dropped, in one undo step', () => {
    const { node, pose, undoSteps } = drag(40);
    expect(node.parent).toBe(PAGE_B);
    // World x 130, in page b's frame at x 110.
    expect(pose).toMatchObject({ x: 20, y: 10 });
    expect(undoSteps).toBe(1);
  });

  it('keeps one dropped off every page in its page, with part of it still on, with the pasteboard off', () => {
    const { node, pose } = drag(400);
    expect(node.parent).toBe(PAGE_A);
    expect(pose.x).toBe(99);
    expect(pose.x + pose.width).toBeGreaterThan(0);
  });

  it('moves it into the other page whatever the binding\'s reparentOnDrop says', () => {
    expect(drag(40, { params: { reparentOnDrop: 'top' } }).node.parent).toBe(PAGE_B);
  });

  it('makes one dropped off every page a root, where it was dropped, with the pasteboard on', () => {
    const { node, pose } = drag(400, { pasteboard: true });
    expect(node.parent).toBeNull();
    expect(pose).toMatchObject({ x: 490, y: 10 });
  });

  it('moves a root on the pasteboard dropped on a page into it', () => {
    const { node, pose } = drag(-250, { pasteboard: true, id: asNodeId('loose'), from: { x: 305, y: 15 } });
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 50, y: 10 });
  });

  it('leaves a move within one page a translate', () => {
    const { node, pose } = drag(-50);
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 40, y: 10 });
  });
});
