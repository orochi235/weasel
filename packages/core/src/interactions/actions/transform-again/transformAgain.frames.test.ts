import { describe, it, expect } from 'vitest';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { FRAME_FIXTURE_IDS, FRAME_FIXTURE_WORLD, makeFrameFixture } from 'core/scene/frameFixture';
import type { RectPose, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { scenePoseFrame } from '../poseFrame';
import { moveAction } from '../move/action';
import { cloneAction } from '../clone/action';
import { duplicateAction } from '../defaults/duplicate';
import { nudgeRightAction } from '../defaults/nudge';
import { transformAgainAction } from './action';

type AnyScene = Scene<unknown, string, unknown>;

/** Child `a` of a group turned a quarter turn: its parent's +x is the world's +y. */
function setup() {
  const scene = makeFrameFixture() as unknown as AnyScene;
  let current: string[] = [FRAME_FIXTURE_IDS.upright];
  const selection = {
    get: () => current,
    set: (next: string[]) => { current = [...next]; },
  } as unknown as SelectionApi;
  const deps = { scene, selection, resizePolicy: { constraints: [], expandIds: (x: string[]) => x } };
  const world = (id: string) => scenePoseFrame(scene).world(id as never) as RectPose;
  const ctx = (p: { x: number; y: number }, extra: Record<string, unknown> = {}) => ({
    world: p, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps, ...extra,
  }) as unknown as InvocationCtx;
  const immediate = (a: { invoker?: unknown }) => (a.invoker as ImmediateInvoker).run(deps as never);
  const drag = (action: { invoker?: unknown }, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const at = (p: { x: number; y: number }) => ctx(p, {
      drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } },
    });
    const handle = (action.invoker as OngoingInvoker).start(at(from), undefined as never);
    handle.onMove!(at(to));
    handle.onEnd!(at(to), 'commit');
  };
  return { scene, selection, world, immediate, drag, again: () => immediate(transformAgainAction) };
}

const START = FRAME_FIXTURE_WORLD.a;

/** `pose` sits `(dx, dy)` from where `a` started, in world. */
function expectAt(pose: RectPose, dx: number, dy: number) {
  expect(pose.x).toBeCloseTo(START.x + dx, 6);
  expect(pose.y).toBeCloseTo(START.y + dy, 6);
}

describe('transformAgain under a turned parent', () => {
  it('repeats a drag the way the drag went on screen', () => {
    const t = setup();
    t.drag(moveAction, { x: 75, y: 20 }, { x: 85, y: 20 });
    expectAt(t.world('a'), 10, 0);
    t.again();
    expectAt(t.world('a'), 20, 0);
  });

  it('nudges along the screen, and repeats it the same way', () => {
    const t = setup();
    t.immediate(nudgeRightAction);
    expectAt(t.world('a'), 1, 0);
    t.again();
    expectAt(t.world('a'), 2, 0);
  });

  it('steps a repeated Alt-drag clone the way the clone was dragged', () => {
    const t = setup();
    t.drag(cloneAction, { x: 75, y: 20 }, { x: 85, y: 20 });
    const first = t.selection.get()[0];
    expectAt(t.world(first), 10, 0);
    t.again();
    const second = t.selection.get()[0];
    expect(second).not.toBe(first);
    expectAt(t.world(second), 20, 0);
  });

  it('duplicates down and to the right on screen', () => {
    const t = setup();
    t.immediate(duplicateAction);
    const copy = t.selection.get()[0];
    expectAt(t.world(copy), 12, 12);
  });
});
