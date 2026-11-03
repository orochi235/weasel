/** A move in a paged scene: a page's child dropped on another page, on the pasteboard, or off every page. */
import { describe, expect, it } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { asNodeId, type AddNodeSpec, type NodeId, type RectPose } from 'core/scene/types';
import { PAGE_A, PAGE_B, ON_PAGE, pagedScene } from 'core/pages/pagedFixture';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const R2 = asNodeId('r2');
const LOOSE = asNodeId('loose');
const G = asNodeId('g');

type Spec = AddNodeSpec<object, 'paper' | 'ink', RectPose>;
const rect = (id: NodeId, parent: NodeId | null, x: number, more: Partial<Spec> = {}): Spec => ({
  id, kind: 'mark', layer: 'ink', ...(parent ? { parent } : {}), pose: { x, y: 10, width: 20, height: 10 }, data: {}, ...more,
});

/**
 * Select `ids`, press at `from` and release `dx` to the right. Page `a` spans world x 0..100 and page `b`
 * 110..210, both y 0..50; `ON_PAGE` sits at world (90, 10) on page `a`, 20 × 10.
 */
function drag(dx: number, options: {
  pasteboard?: boolean; ids?: NodeId[]; add?: Spec[]; from?: { x: number; y: number };
  params?: Record<string, unknown>; nodeAtPoint?: (at: { x: number; y: number }) => NodeId | null;
} = {}) {
  const { scene } = pagedScene({ pasteboard: options.pasteboard ?? false });
  for (const spec of options.add ?? []) scene.add(spec);
  const ids = options.ids ?? [ON_PAGE];
  const from = options.from ?? { x: 95, y: 15 };
  const entries = scene.historyEntries().length;
  const deps = { selection: { get: () => ids }, scene, nodeAtPoint: options.nodeAtPoint ?? (() => null) };
  const base = { world: from, modifiers: MODS, deps };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: options.params ?? {} } as BindingOpts);
  const to = { x: from.x + dx, y: from.y };
  const at = { ...base, world: to, drag: { start: from, current: to, delta: { x: dx, y: 0 } } } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  const node = scene.get(ids[0]!)!;
  return { scene, node, pose: node.pose as RectPose, undoSteps: scene.historyEntries().length - entries };
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
  });

  it('keeps one dropped off page b in page b, 1 unit of it on b, in b\'s frame', () => {
    const { node, pose } = drag(300, { ids: [R2], add: [rect(R2, PAGE_B, 50)], from: { x: 165, y: 15 } });
    expect(node.parent).toBe(PAGE_B);
    // World x 209 is x 99 in page b's frame.
    expect(pose.x).toBe(99);
  });

  it('moves it into the other page whatever the binding\'s reparentOnDrop says', () => {
    expect(drag(40, { params: { reparentOnDrop: 'top' } }).node.parent).toBe(PAGE_B);
  });

  it('moves it into a group under the pointer on the other page when the binding reparents on drop', () => {
    const group = { ...rect(G, PAGE_B, 10), kind: 'group' as const, pose: { x: 10, y: 0, width: 60, height: 40 } };
    const { node, pose } = drag(40, { add: [group], params: { reparentOnDrop: 'top' }, nodeAtPoint: () => G });
    expect(node.parent).toBe(G);
    // World x 130: page b at 110, the group at 10 in it.
    expect(pose).toMatchObject({ x: 10, y: 10 });
  });

  it('moves each selected root by where its own box lands, not by the page under the pointer', () => {
    // r1 on page a at world 50, r2 on page b at world 160; grab r2 and nudge: r1 stays on page a.
    const r1 = asNodeId('r1');
    const { scene } = drag(5, {
      ids: [r1, R2], add: [rect(r1, PAGE_A, 50), rect(R2, PAGE_B, 50)], from: { x: 165, y: 15 },
    });
    expect(scene.get(r1)!.parent).toBe(PAGE_A);
    expect((scene.get(r1)!.pose as RectPose).x).toBe(55);
    expect(scene.get(R2)!.parent).toBe(PAGE_B);
    expect((scene.get(R2)!.pose as RectPose).x).toBe(55);
  });

  it('keeps each of several roots on a page when the pointer lands on one', () => {
    // A 5-wide rect at world 10 on page a, dragged with ON_PAGE so the pointer lands on page b and the
    // rect wholly in the gap (102..107): it stays in a, 1 unit on it.
    const left = rect(asNodeId('left'), PAGE_A, 10, { pose: { x: 10, y: 10, width: 5, height: 10 } });
    const { scene } = drag(92, { ids: [ON_PAGE, asNodeId('left')], add: [left] });
    expect(scene.get(ON_PAGE)!.parent).toBe(PAGE_B);
    const landed = scene.get(asNodeId('left'))!;
    expect(landed.parent).toBe(PAGE_A);
    expect((landed.pose as RectPose).x).toBe(99);
  });

  it('makes one dropped off every page a root, where it was dropped, with the pasteboard on', () => {
    const { node, pose } = drag(400, { pasteboard: true });
    expect(node.parent).toBeNull();
    expect(pose).toMatchObject({ x: 490, y: 10 });
  });

  it('moves a root on the pasteboard dropped on a page into it', () => {
    const { node, pose } = drag(-250, { pasteboard: true, ids: [LOOSE], add: [rect(LOOSE, null, 300)], from: { x: 305, y: 15 } });
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 50, y: 10 });
  });

  it('leaves a move within one page a translate', () => {
    const { node, pose } = drag(-50);
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 40, y: 10 });
  });
});
