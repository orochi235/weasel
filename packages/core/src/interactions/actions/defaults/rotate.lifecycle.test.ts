import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { rotateAction } from './rotate';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { RotateBehavior } from '../../gestures/types';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };

function setup(selected: 'a' | 'ab' = 'a') {
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 50, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const ids = selected === 'a' ? [a] : [a, b];
  const recorded = () => scene.historyEntries().length - 2;
  // Union center of the selection; the pointer starts due east of it.
  const center = selected === 'a' ? { x: 5, y: 5 } : { x: 30, y: 5 };
  const base = {
    world: { x: center.x + 10, y: center.y },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ids as NodeId[] },
      scene: scene,
    } as Record<string, unknown>,
  };
  /** A frame with the pointer a quarter turn round from where it started. */
  const quarter = { ...base, world: { x: center.x, y: center.y + 10 } } as InvocationCtx;
  return { scene, a, b, base, quarter, recorded };
}

function invoker() {
  const inv = rotateAction.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  return inv;
}

function turn(
  s: ReturnType<typeof setup>,
  opts: BindingOpts | undefined,
  reason: 'commit' | 'cancel' = 'commit',
) {
  const handle = invoker().start(s.base as InvocationCtx, opts);
  handle.onMove?.(s.quarter);
  handle.onEnd?.(s.quarter, reason);
}

const center = (p: Pose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

describe('rotateAction — label and transient', () => {
  it('params.label names the history entry', () => {
    const s = setup();
    turn(s, { params: { label: 'Spin' } });
    expect(s.scene.historyEntries().at(-1)?.label).toBe('Spin');
  });

  it('params.transient rotates without recording an undo entry', () => {
    const s = setup();
    turn(s, { params: { transient: true } });
    expect(s.scene.get(s.a)!.pose.rotation).toBeCloseTo(Math.PI / 2);
    expect(s.recorded()).toBe(0);
  });

  it('a behavior with defaultTransient makes the gesture transient', () => {
    const s = setup();
    turn(s, { behaviors: [{ defaultTransient: true }] });
    expect(s.scene.get(s.a)!.pose.rotation).toBeCloseTo(Math.PI / 2);
    expect(s.recorded()).toBe(0);
  });
});

describe('rotateAction — onGestureStart / onGestureEnd', () => {
  it('fires start with the rotated ids and end(true) on commit', () => {
    const s = setup('ab');
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    turn(s, { params: { onGestureStart, onGestureEnd } });
    expect(onGestureStart).toHaveBeenCalledWith([s.a, s.b]);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('fires end(false) on cancel', () => {
    const s = setup();
    const onGestureEnd = vi.fn();
    turn(s, { params: { onGestureEnd } }, 'cancel');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('fires end(false) on a release that never turned', () => {
    const s = setup();
    const onGestureEnd = vi.fn();
    const handle = invoker().start(s.base as InvocationCtx, { params: { onGestureEnd } });
    handle.onEnd!(s.base as InvocationCtx, 'commit');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});

describe('rotateAction — pivot', () => {
  it("'each' turns every node about its own center", () => {
    const s = setup('ab');
    turn(s, { params: { pivot: 'each' } });
    expect(center(s.scene.get(s.a)!.pose)).toEqual({ x: 5, y: 5 });
    expect(center(s.scene.get(s.b)!.pose)).toEqual({ x: 55, y: 5 });
    expect(s.scene.get(s.b)!.pose.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('defaults to orbiting the union center', () => {
    const s = setup('ab');
    turn(s, undefined);
    const c = center(s.scene.get(s.b)!.pose);
    expect(c.x).toBeCloseTo(30);
    expect(c.y).toBeCloseTo(30);
  });
});

describe('rotateAction — behaviors', () => {
  const snapTo = (angle: number): RotateBehavior<Pose> => ({
    onMove: (_ctx, proposed) => ({ pose: { ...proposed.pose, rotation: angle } }),
  });

  it('runs onStart with the rotated ids', () => {
    const s = setup();
    const onStart = vi.fn();
    turn(s, { behaviors: [{ onStart }] });
    expect(onStart.mock.calls[0][0].draggedIds).toEqual([s.a]);
  });

  it('proposes the turned pose and rotation to onMove', () => {
    const s = setup();
    const onMove = vi.fn();
    turn(s, { behaviors: [{ onMove }] });
    const proposed = onMove.mock.calls[0][1];
    expect(proposed.rotation).toBeCloseTo(Math.PI / 2);
    expect(proposed.pose.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("an onMove pose sets the gesture's rotation", () => {
    const s = setup('ab');
    turn(s, { behaviors: [snapTo(Math.PI / 4)] });
    expect(s.scene.get(s.a)!.pose.rotation).toBeCloseTo(Math.PI / 4);
    expect(s.scene.get(s.b)!.pose.rotation).toBeCloseTo(Math.PI / 4);
  });

  it('onEnd returning null aborts the commit', () => {
    const s = setup();
    const onGestureEnd = vi.fn();
    turn(s, { behaviors: [{ onEnd: () => null }], params: { onGestureEnd } });
    expect(s.scene.get(s.a)!.pose.rotation).toBeUndefined();
    expect(s.recorded()).toBe(0);
    expect(s.scene.overrides.has(s.a)).toBe(false);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('onEnd returning ops commits those in place of the rotation', () => {
    const s = setup();
    turn(s, { behaviors: [{ onEnd: () => [] }] });
    expect(s.scene.get(s.a)!.pose.rotation).toBeUndefined();
  });
});
