/** A move in a paged scene: a page's child dropped on another page, on the pasteboard, or off every page. */
import { describe, expect, it } from 'vitest';
import type { BindingOptions, InvocationCtx } from '@weasel-js/routing';
import { asNodeId, type AddNodeSpec, type NodeId, type RectPose } from 'core/scene/types';
import { PAGE_A, PAGE_B, ON_PAGE, pagedScene } from 'core/pages/pagedFixture';
import { moveAction } from './action';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { resolveDrop } from './commit/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { LayoutStrategy } from '../../../layout/types';
import type { SnapTarget } from 'core/adapters/types';
import { snapToContainer } from './behaviors/snapToContainer';

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
  scene?: ReturnType<typeof pagedScene>['scene'];
} = {}) {
  const scene = options.scene ?? pagedScene({ pasteboard: options.pasteboard ?? false }).scene;
  for (const spec of options.add ?? []) scene.add(spec);
  const ids = options.ids ?? [ON_PAGE];
  const from = options.from ?? { x: 95, y: 15 };
  const entries = scene.historyEntries().length;
  const deps = { selection: { get: () => ids }, scene, nodeAtPoint: options.nodeAtPoint ?? (() => null) };
  const base = { world: from, modifiers: MODS, deps };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: options.params ?? {} } as BindingOptions);
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

  it('moves a box straddling both pages to the page it overlaps most, the pointer in the gap', () => {
    const wide = (more: number) => drag(more, {
      ids: [R2], add: [rect(R2, PAGE_A, 70, { pose: { x: 70, y: 10, width: 40, height: 10 } })], from: { x: 80, y: 15 },
    });
    // World 95..135: 5 on page a, 25 on page b.
    expect(wide(25).node.parent).toBe(PAGE_B);
    // World 75..115: 25 on page a, 5 on page b.
    expect(wide(5).node.parent).toBe(PAGE_A);
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

  it('moves one on a lower layer into a group on the other page onto the group\'s layer, in one undo step', () => {
    const group = { ...rect(G, PAGE_B, 10), kind: 'group' as const, pose: { x: 10, y: 0, width: 60, height: 40 } };
    const low = rect(asNodeId('low'), PAGE_A, 50, { layer: 'paper' });
    const { node, pose, undoSteps } = drag(100, {
      ids: [asNodeId('low')], add: [group, low], from: { x: 55, y: 15 }, params: { reparentOnDrop: 'top' }, nodeAtPoint: () => G,
    });
    expect(node).toMatchObject({ parent: G, layer: 'ink' });
    // World x 150: page b at 110, the group at 10 in it.
    expect(pose).toMatchObject({ x: 30, y: 10 });
    expect(undoSteps).toBe(1);
  });

  it('lands a drop into a group on the other page just above the node under the pointer', () => {
    const group = { ...rect(G, PAGE_B, 10), kind: 'group' as const, pose: { x: 10, y: 0, width: 60, height: 40 } };
    const [low, high] = [asNodeId('low'), asNodeId('high')];
    const { scene, node } = drag(40, {
      add: [group, rect(low, G, 0), rect(high, G, 30)], params: { reparentOnDrop: 'above' }, nodeAtPoint: () => low,
    });
    expect(node.parent).toBe(G);
    expect(scene.childrenOf(G)).toEqual([low, ON_PAGE, high]);
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

  it('moves a selected child with its group\'s shift when the group is kept on its page', () => {
    // G at world 70..90 on page a, its child C at G's x 0; both selected and dragged far off page a.
    const C = asNodeId('c');
    const group = { ...rect(G, PAGE_A, 70), kind: 'group' as const };
    const { scene } = drag(400, { ids: [G, C], add: [group, rect(C, G, 0)], from: { x: 75, y: 15 } });
    expect(scene.get(G)!.parent).toBe(PAGE_A);
    expect((scene.get(G)!.pose as RectPose).x).toBe(99);
    expect((scene.get(C)!.pose as RectPose).x).toBe(0);
  });

  it('moves a selected child of an envelope with the envelope\'s shift when it is kept on its page', () => {
    // The envelope E is its children, C at world 70..90 and D at 50..60, both stored in page a's frame.
    // E and C are selected and dragged off page a; E (50..90) is shifted to 99..139 so 1 unit stays on.
    const [E, C, D] = [asNodeId('e'), asNodeId('c'), asNodeId('d')];
    const envelope = {
      ...rect(E, PAGE_A, 50), kind: 'group' as const, dependsOn: 'children' as const, derivePose: unionOfChildren,
    };
    const narrow = rect(D, E, 50, { pose: { x: 50, y: 10, width: 10, height: 10 } });
    const { scene } = drag(400, { ids: [E, C], add: [envelope, rect(C, E, 70), narrow], from: { x: 75, y: 15 } });
    expect(scene.get(C)!.parent).toBe(E);
    expect((scene.get(D)!.pose as RectPose).x).toBe(99);
    // C lands 20 right of D, as it started.
    expect((scene.get(C)!.pose as RectPose).x).toBe(119);
  });

  it('moves a selected child of an envelope into the page its envelope lands on, where it was dropped', () => {
    const [E, C, D] = [asNodeId('e'), asNodeId('c'), asNodeId('d')];
    const envelope = {
      ...rect(E, PAGE_A, 50), kind: 'group' as const, dependsOn: 'children' as const, derivePose: unionOfChildren,
    };
    const narrow = rect(D, E, 50, { pose: { x: 50, y: 10, width: 10, height: 10 } });
    // E (50..90) lands at 90..130, mostly on page b, whose frame starts at world 110.
    const { scene } = drag(40, { ids: [E, C], add: [envelope, rect(C, E, 70), narrow], from: { x: 75, y: 15 } });
    expect(scene.get(E)!.parent).toBe(PAGE_B);
    expect((scene.get(D)!.pose as RectPose).x).toBe(-20);
    expect((scene.get(C)!.pose as RectPose).x).toBe(0);
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

  it('does not drop onto a locked page, keeping the node on its own', () => {
    const { scene } = pagedScene();
    scene.setLocked(PAGE_B, true);
    const { node, pose } = drag(40, { scene });
    expect(node.parent).toBe(PAGE_A);
    expect(pose.x).toBe(99);
  });

  it('does not drop into a group on a locked page when the binding reparents on drop', () => {
    const { scene } = pagedScene();
    scene.add({ ...rect(G, PAGE_B, 10), kind: 'group', pose: { x: 10, y: 0, width: 60, height: 40 } });
    scene.setLocked(PAGE_B, true);
    const { node } = drag(40, { scene, params: { reparentOnDrop: 'top' }, nodeAtPoint: () => G });
    expect(node.parent).toBe(PAGE_A);
  });

  it('leaves a move within one page a translate', () => {
    const { node, pose } = drag(-50);
    expect(node.parent).toBe(PAGE_A);
    expect(pose).toMatchObject({ x: 40, y: 10 });
  });
});

describe('a node following others, when what it follows moves between pages', () => {
  const S2 = asNodeId('s2');
  const F = asNodeId('f');

  it('goes into the run when one of its nodes moves to another page, and back onto the page when it returns', () => {
    const { scene } = drag(0, { add: [
      rect(S2, PAGE_A, 10),
      { ...rect(F, PAGE_A, 0), dependsOn: [ON_PAGE, S2] },
    ] });
    const run = scene.get(PAGE_A)!.parent;
    drag(40, { scene });
    expect(scene.get(ON_PAGE)!.parent).toBe(PAGE_B);
    expect(scene.get(F)!.parent).toBe(run);
    drag(-40, { scene, from: { x: 135, y: 15 } });
    expect(scene.get(ON_PAGE)!.parent).toBe(PAGE_A);
    expect(scene.get(F)!.parent).toBe(PAGE_A);
  });

  it('goes into the run from inside a group on the page when one of its nodes moves to another page', () => {
    const { scene } = drag(0, { add: [
      rect(S2, PAGE_A, 10),
      { ...rect(G, PAGE_A, 30), kind: 'group' },
      { ...rect(F, G, 0), dependsOn: [ON_PAGE, S2] },
    ] });
    drag(40, { scene });
    expect(scene.get(ON_PAGE)!.parent).toBe(PAGE_B);
    expect(scene.get(F)!.parent).toBe(scene.get(PAGE_A)!.parent);
  });

  it('moves to the page everything it follows lands on, in the same undo step', () => {
    const { scene, undoSteps } = drag(40, { ids: [ON_PAGE, S2], add: [
      rect(S2, PAGE_A, 80),
      { ...rect(F, PAGE_A, 0), dependsOn: [ON_PAGE, S2] },
    ] });
    expect(scene.get(S2)!.parent).toBe(PAGE_B);
    expect(scene.get(F)!.parent).toBe(PAGE_B);
    expect(undoSteps).toBe(1);
  });
});

describe('a node following others, when a drop into a container moves what it follows to another page', () => {
  const [G1, G2, G3, N, M, C] = ['g1', 'g2', 'g3', 'n', 'm', 'c'].map(asNodeId);
  const group = (id: NodeId, parent: NodeId, x: number) =>
    ({ ...rect(id, parent, x), kind: 'group' as const, pose: { x, y: 0, width: 40, height: 40 } });

  /** `n` in group g1 on page a, `m` on page a, and g2 on page b; `c`, following `n` and `m`, under `cParent`. */
  function dragNIntoG2(cParent: (scene: ReturnType<typeof pagedScene>['scene']) => NodeId) {
    const { scene } = pagedScene();
    scene.add(group(G1, PAGE_A, 0));
    scene.add(rect(N, G1, 5));
    scene.add(rect(M, PAGE_A, 50));
    scene.add(group(G2, PAGE_B, 10));
    scene.add(group(G3, PAGE_A, 60));
    scene.add({ ...rect(C, cParent(scene), 0), dependsOn: [N, M] });
    // n sits at world 5..25 on page a; +130 puts it over g2, at world 135..155 on page b.
    const { undoSteps } = drag(130, { scene, ids: [N], from: { x: 10, y: 15 }, params: { reparentOnDrop: 'top' }, nodeAtPoint: () => G2 });
    return { scene, run: scene.get(PAGE_A)!.parent, undoSteps };
  }

  it('moves one on the old page into the run, in the same undo step', () => {
    const { scene, run, undoSteps } = dragNIntoG2(() => PAGE_A);
    expect(scene.get(N)!.parent).toBe(G2);
    expect(scene.get(C)!.parent).toBe(run);
    expect(undoSteps).toBe(1);
  });

  it('moves one nested in a group on the old page into the run', () => {
    const { scene, run } = dragNIntoG2(() => G3);
    expect(scene.get(C)!.parent).toBe(run);
  });

  it('moves one on the old page into the run when snapToContainer takes what it follows to the other page', () => {
    const { scene } = pagedScene();
    scene.add(group(G1, PAGE_A, 0));
    scene.add(rect(N, G1, 5));
    scene.add(rect(M, PAGE_A, 50));
    scene.add(group(G2, PAGE_B, 10));
    scene.add({ ...rect(C, PAGE_A, 0), dependsOn: [N, M] });
    const target: SnapTarget<RectPose> = { parentId: G2, slotPose: { x: 130, y: 10, width: 20, height: 10 } };
    const invoker = moveAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = { world: { x: 10, y: 15 }, modifiers: MODS, deps: { selection: { get: () => [N] }, scene } };
    const to = { x: 140, y: 15 };
    const at = { ...base, world: to, drag: { start: base.world, current: to, delta: { x: 130, y: 0 } } } as unknown as InvocationCtx;
    const entries = scene.historyEntries().length;
    const handle = invoker.start(base as unknown as InvocationCtx, {
      behaviors: [snapToContainer<RectPose>({ dwellMs: 0, isInstant: () => true, findTarget: () => target }) as never],
    } as BindingOptions);
    handle.onMove!(at);
    handle.onEnd!(at, 'commit');
    expect(scene.get(N)!.parent).toBe(G2);
    expect(scene.get(C)!.parent).toBe(scene.get(PAGE_A)!.parent);
    expect(scene.historyEntries().length - entries).toBe(1);
  });

  it('moves one on the old page into the run when a layout container on the other page takes what it follows', () => {
    const { scene } = pagedScene();
    scene.add(group(G1, PAGE_A, 0));
    scene.add(rect(N, G1, 5));
    scene.add(rect(M, PAGE_A, 50));
    scene.add(group(G2, PAGE_B, 10));
    scene.add({ ...rect(C, PAGE_A, 0), dependsOn: [N, M] });
    const slot = { x: 130, y: 10, width: 20, height: 10 };
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => [{ pose: slot, origin: { x: slot.x, y: slot.y } }],
      reflowPoses: () => new Map(),
      commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: RectPose }, target: { pose: RectPose }) =>
        [createTransformOp<RectPose>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
    } as unknown as LayoutStrategy<unknown>;
    const invoker = moveAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 10, y: 15 }, modifiers: MODS,
      deps: { selection: { get: () => [N] }, scene, layout: { getLayout: (id: string) => (id === G2 ? layout : null) } },
    };
    const to = { x: 140, y: 15 };
    const drag = { start: base.world, current: to, delta: { x: 130, y: 0 } };
    const handle = invoker.start(base as unknown as InvocationCtx, { params: {} } as BindingOptions);
    handle.onMove!({ ...base, world: to, drag } as unknown as InvocationCtx);
    handle.onEnd!({ ...base, world: to, drag } as unknown as InvocationCtx, 'commit');
    expect(scene.get(N)!.parent).toBe(G2);
    expect(scene.get(C)!.parent).toBe(scene.get(PAGE_A)!.parent);
  });
});

describe('resolveDrop in a paged scene', () => {
  it('stops at a page that refuses the drop, rather than climbing to the top of the tree', () => {
    const { scene } = pagedScene();
    scene.add(rect(R2, PAGE_B, 50));
    const session = { scene, ids: [ON_PAGE], cascadeIds: [], nodeAtPoint: () => R2, verdict: () => false };
    expect(resolveDrop(session as never, { x: 165, y: 15 })).toBeNull();
    const admits = { ...session, verdict: (id: NodeId) => id === PAGE_B };
    expect(resolveDrop(admits as never, { x: 165, y: 15 })).toMatchObject({ newParent: PAGE_B, hitSibling: R2 });
  });
});
