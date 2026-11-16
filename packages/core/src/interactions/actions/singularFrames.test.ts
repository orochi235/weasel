/**
 * Edits against a container whose frame is singular (`transform: [0, 0, 0, 1]` draws its children flat). An edit
 * that promises to keep a node where it is shown refuses whole when that node would be stored in such a frame,
 * leaving the scene and its history as they were; a transform leaves a node stored there where it is.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { childVerdict } from './admitsChild';
import { insertParent } from '../../canvas/deps/insertParent';
import { followerMove } from './followerMoves';
import { moveNodes } from './moveNodes';
import { scenePoseFrame } from './poseFrame';
import { siteIn } from 'canvas/deps/insertSite';
import { groupAction, ungroupAction, booleanGroupOps } from '@weasel-js/editing';

const [FLAT, A, B, G, E, C] = ['flat', 'a', 'b', 'g', 'e', 'c'].map(asNodeId);
const mark = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

/** `flat`, collapsed along x, holding marks `a` and `b` and group `g` with `e` in it; `c` at the root. */
function setup() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
  scene.add({ id: FLAT, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100, transform: [0, 0, 0, 1] } });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, parent: FLAT, pose: mark(10, 10) });
  scene.add({ id: B, kind: 'mark', layer: 'main', data: {}, parent: FLAT, pose: mark(40, 60) });
  scene.add({ id: G, kind: 'group', layer: 'main', data: {}, parent: FLAT, pose: mark(20, 20) });
  scene.add({ id: E, kind: 'mark', layer: 'main', data: {}, parent: G, pose: mark(1, 1) });
  scene.add({ id: C, kind: 'mark', layer: 'main', data: {}, pose: mark(200, 200) });
  scene.history.clear();
  return scene;
}

function deps(scene: Scene<unknown, string, unknown>, ids: NodeId[]) {
  return { scene, operands: { get: () => ids, set: vi.fn() } } as never;
}

const snapshot = (scene: Scene<unknown, string, unknown>) =>
  JSON.stringify([...scene.nodes.values()].map((n) => [n.id, n.parent, n.pose]));

function expectRefused(scene: Scene<unknown, string, unknown>, edit: () => void): void {
  const before = snapshot(scene);
  edit();
  expect(snapshot(scene)).toBe(before);
  expect(scene.history.undoDepth()).toBe(0);
}

describe('world-preserving edits into a singular frame', () => {
  it('group refuses members whose container would land in it', () => {
    const scene = setup();
    expect(groupAction.enabled!(deps(scene, [A, B]))).toBe(ActionDisabledReason.NotApplicable);
    expectRefused(scene, () => (groupAction.invoker as ImmediateInvoker).run(deps(scene, [A, B])));
  });

  it('ungroup refuses a container whose children would land in it', () => {
    const scene = setup();
    expect(ungroupAction.enabled!(deps(scene, [G]))).toBe(ActionDisabledReason.NotApplicable);
    expectRefused(scene, () => (ungroupAction.invoker as ImmediateInvoker).run(deps(scene, [G])));
  });

  it('ungroup frees the children of the singular container itself where they draw', () => {
    const scene = setup();
    const before = scenePoseFrame(scene).world(A);
    expect(ungroupAction.enabled!(deps(scene, [FLAT]))).toBe(true);
    (ungroupAction.invoker as ImmediateInvoker).run(deps(scene, [FLAT]));
    expect(scene.get(A)!.parent).toBeNull();
    expect(scenePoseFrame(scene).world(A)).toEqual(before);
  });

  it('a boolean group of its children is refused', () => {
    expect(booleanGroupOps(setup(), [A, B])).toBeNull();
  });

  it('takes no children by drop, insert, or paste', () => {
    const scene = setup();
    expect(childVerdict(scene, FLAT, [C], () => true)).toBe(false);
    expect(insertParent(scene, FLAT, () => true)).toBeNull();
    expect(siteIn(scene, FLAT).parent).toBeNull();
  });

  it('moves no follower into it', () => {
    expect(followerMove(setup(), C, FLAT)).toBeNull();
  });
});

describe('transforms of a node stored in a singular frame', () => {
  it('a move leaves it where it is and moves the rest', () => {
    const scene = setup();
    expect(moveNodes(deps(scene, [A, C]), [A, C], { dx: 5, dy: 3 })).toBe(true);
    expect(scene.get(A)!.pose).toEqual(mark(10, 10));
    expect(scene.get(C)!.pose).toEqual(mark(205, 203));
    expect(scene.history.undoDepth()).toBe(1);
  });
});
