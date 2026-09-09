/**
 * The transport, stepped a frame at a time.
 *
 * jsdom cannot drag, so "a pin holds" is not testable here directly. What is
 * testable on this side of the boundary is the contract a pin rests on: an
 * override the run did not publish reaches `step` as pinned, and the run
 * neither writes nor commits that id. Read those two as a proxy for the
 * browser behavior, not as the behavior.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createScene } from '../../core/scene/scene';
import type { NodeId, RectPose } from '../../core/scene/types';
import { effectivePose } from '../../core/scene/effectivePose';
import { usePoseRun, type PoseRun, type PoseRunCtx, type PoseRunStep } from './usePoseRun';

const LAYERS = [{ id: 'main' as const }];
const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

/** Manual rAF driver, the same shape `useSimulation`'s tests use. */
function makeClock() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  let now = 0;
  return {
    requestFrame: (cb: (t: number) => void): number => {
      const h = next++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
    frame() {
      now += 16;
      const due = [...callbacks.entries()];
      callbacks.clear();
      for (const [, cb] of due) cb(now);
    },
    frames(n: number) { for (let i = 0; i < n; i++) this.frame(); },
    pending: () => callbacks.size,
  };
}

function setup(step: (ctx: PoseRunCtx<RectPose>) => PoseRunStep<RectPose>, label?: string) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: box(50, 0), data: {} });
  const clock = makeClock();
  const onCommit = vi.fn();
  const { result, unmount } = renderHook(() => usePoseRun<RectPose>({
    scene,
    step,
    onCommit,
    ...(label === undefined ? {} : { label }),
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
  }));
  const run = (): PoseRun => result.current;
  const drawnAt = (id: NodeId): RectPose => effectivePose(scene, scene.get(id)!);
  return { scene, a, b, clock, run, onCommit, drawnAt, unmount };
}

/** Marches `a` right by 10 a frame, done after `frames`. */
const marching = (a: NodeId, frames: number) =>
  ({ frame }: PoseRunCtx<RectPose>): PoseRunStep<RectPose> => ({
    poses: [[a, box((frame + 1) * 10, 0)]],
    done: frame + 1 >= frames,
  });

describe('usePoseRun', () => {
  it('shows each frame without writing the document', () => {
    const { a, clock, run, scene, drawnAt } = setup((ctx) => marching(a, 10)(ctx));
    act(() => { run().start(); });
    act(() => { clock.frames(3); });
    expect(drawnAt(a)).toEqual(box(30, 0));
    // The document is untouched until it commits.
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
  });

  it('commits one undo entry when the producer says it is done', () => {
    const { a, clock, run, scene, onCommit } = setup((ctx) => marching(a, 3)(ctx));
    const before = scene.getVersion();
    act(() => { run().start(); });
    act(() => { clock.frames(3); });
    expect(scene.get(a)!.pose).toEqual(box(30, 0));
    expect(onCommit).toHaveBeenCalledWith(1);
    act(() => { scene.undo(); });
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.getVersion()).toBeGreaterThan(before);
  });

  it('stops asking for frames once it is done', () => {
    const { a, clock, run } = setup((ctx) => marching(a, 2)(ctx));
    act(() => { run().start(); });
    act(() => { clock.frames(2); });
    expect(run().isRunning()).toBe(false);
    expect(clock.pending()).toBe(0);
  });

  it('commits where it stands when the consumer stops it early', () => {
    const { a, clock, run, scene } = setup((ctx) => marching(a, 100)(ctx));
    act(() => { run().start(); });
    act(() => { clock.frames(2); });
    act(() => { run().stop(); });
    expect(scene.get(a)!.pose).toEqual(box(20, 0));
  });

  it('writes nothing when it is canceled', () => {
    const { a, clock, run, scene, drawnAt } = setup((ctx) => marching(a, 100)(ctx));
    act(() => { run().start(); });
    act(() => { clock.frames(2); });
    act(() => { run().cancel(); });
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(drawnAt(a)).toEqual(box(0, 0));
  });

  it('drops its frames on unmount rather than committing them', () => {
    const { a, clock, run, scene, unmount } = setup((ctx) => marching(a, 100)(ctx));
    act(() => { run().start(); });
    act(() => { clock.frames(2); });
    act(() => { unmount(); });
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.overrides.ids()).toEqual([]);
  });

  it('names the undo entry', () => {
    const { a, clock, run, scene } = setup((ctx) => marching(a, 1)(ctx), 'Relax');
    act(() => { run().start(); });
    act(() => { clock.frames(1); });
    expect(scene.historyEntries().at(-1)?.label).toBe('Relax');
  });
});

describe('a node another gesture owns', () => {
  /** What `step` was told, frame by frame. */
  const seen: ReadonlyMap<NodeId, RectPose>[] = [];

  function pinnedSetup() {
    seen.length = 0;
    // The ids are minted by `scene.add` inside `setup`, and `step` first runs
    // a frame later, by which time these are filled.
    const ids: { a?: NodeId; b?: NodeId } = {};
    const s = setup((ctx) => {
      seen.push(ctx.pinned);
      // Deliberately tries to drive both, including the pinned one.
      return {
        poses: [[ids.a!, box(99, 99)] as const, [ids.b!, box(77, 0)] as const],
        done: false,
      };
    });
    ids.a = s.a;
    ids.b = s.b;
    return s;
  }

  it('reaches the producer as pinned, with the pose it is drawn at', () => {
    const { scene, a, clock, run } = pinnedSetup();
    // What a drag publishes: an entry of its own, mutated in place per frame.
    scene.overrides.set(a, { pose: box(5, 5) });
    act(() => { run().start(); });
    act(() => { clock.frames(1); });
    expect(seen[0]!.get(a)).toEqual(box(5, 5));
  });

  it('is never overwritten by the run, and never committed by it', () => {
    const { scene, a, b, clock, run, drawnAt } = pinnedSetup();
    const entry = { pose: box(5, 5) };
    scene.overrides.set(a, entry);
    act(() => { run().start(); });
    act(() => { clock.frames(2); });
    // The mover's own pose still stands.
    expect(drawnAt(a)).toEqual(box(5, 5));
    act(() => { run().stop(); });
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.get(b)!.pose).toEqual(box(77, 0));
  });

  it('takes the node over once the gesture lets go', () => {
    const { scene, a, clock, run, drawnAt } = pinnedSetup();
    scene.overrides.set(a, { pose: box(5, 5) });
    act(() => { run().start(); });
    act(() => { clock.frames(1); });
    act(() => { scene.overrides.clear(a); });
    act(() => { clock.frames(1); });
    expect(seen[1]!.has(a)).toBe(false);
    expect(drawnAt(a)).toEqual(box(99, 99));
  });
});
