import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import { documentPose, effectivePose } from 'core/scene/effectivePose';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { MoveBehavior } from '../../gestures/types';
import { momentum } from '../../../animation/behaviors/momentum';
import { useAnimator } from '@weasel-js/animator/react';

type Pose = { x: number; y: number; width: number; height: number };

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

function setup(deps: Record<string, unknown> = {}) {
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const animator = result.current;
  const opts: BindingOpts = {
    behaviors: [
      momentum<Pose>({ animator, threshold: 0, now: clock.now }) as unknown as MoveBehavior<unknown>,
    ],
  };
  const frame = (x: number): InvocationCtx => ({
    world: { x, y: 0 },
    screen: { x, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [a] as NodeId[] }, scene, ...deps },
    drag: { start: { x: 0, y: 0 }, current: { x, y: 0 }, delta: { x, y: 0 }, screenDelta: { x, y: 0 } },
  }) as unknown as InvocationCtx;
  const inv = moveAction.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  /** Drag `a` 20 units right in one 16ms frame and let go: a flick. */
  const flick = () => {
    const from = frame(0);
    const handle = inv.start(from, opts);
    clock.advance(16);
    handle.onMove?.(frame(20));
    handle.onEnd?.(frame(20), 'commit');
    return handle;
  };
  const settle = (): void => {
    for (let i = 0; i < 2000 && animator.isActive(); i++) clock.advance(100);
  };
  const shownX = () => effectivePose(scene, scene.get(a)!).x;
  const storedX = () => documentPose(scene, scene.get(a)!).x;
  // The add above is an undo entry of its own; count from here.
  const recorded = () => scene.historyEntries().slice(1);
  return { scene, a, clock, animator, flick, settle, shownX, storedX, recorded };
}

describe('moveAction with momentum', () => {
  it('records the whole flick as one entry that one undo takes back', () => {
    const { scene, flick, clock, settle, storedX, recorded } = setup();
    flick();
    for (let i = 0; i < 10; i++) clock.advance(16);
    expect(recorded()).toEqual([]);
    settle();
    expect(recorded().map((e) => e.label)).toEqual(['flick']);
    expect(storedX()).toBeGreaterThan(20);
    scene.undo();
    expect(storedX()).toBe(0);
  });

  it('shows the coast without writing the document until it comes to rest', () => {
    const { flick, clock, settle, shownX, storedX } = setup();
    flick();
    clock.advance(16);
    clock.advance(16);
    expect(shownX()).toBeGreaterThan(20);
    expect(storedX()).toBe(0);
    settle();
    expect(storedX()).toBe(shownX());
  });

  it('keeps the node where it was let go until the first coast frame', () => {
    const { flick, shownX } = setup();
    flick();
    expect(shownX()).toBe(20);
  });

  it('commits the flick through the applyOps dep when one is wired', () => {
    const applyOps = vi.fn((_ops: Op[], _label: string) => {});
    const { flick, settle, recorded } = setup({ applyOps });
    flick();
    settle();
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0][1]).toBe('flick');
    expect(recorded()).toEqual([]);
  });

  it('a drag that catches the coast records it where it stood and starts from there', () => {
    const { flick, clock, shownX, storedX, recorded } = setup();
    flick();
    clock.advance(16);
    clock.advance(16);
    const caughtAt = shownX();
    const handle = flick();
    expect(recorded().map((e) => e.label)[0]).toBe('flick');
    void handle;
    expect(storedX()).toBe(caughtAt);
    expect(shownX()).toBeCloseTo(caughtAt + 20);
  });
});
