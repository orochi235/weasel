import { describe, it, expect, vi } from 'vitest';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { createReparentOp } from 'core/ops/reparent';
import type { Op } from 'core/ops/types';
import { moveGestureAdapter } from './move/gestureAdapter';
import {
  closeGesture,
  commitGestureOps,
  readGestureLifecycle,
  reduceBehaviorEnd,
  runBehaviorCancel,
  runBehaviorSettled,
} from './gestureLifecycle';
import type { BehaviorEnd } from '../gestures/types';

const refuse = (): never => { throw new Error('refused'); };

describe('reduceBehaviorEnd', () => {
  it('hands every onEnd the action\'s own end fields beside `answered`', () => {
    interface End extends BehaviorEnd { tag: string }
    const seen: End[] = [];
    const behaviors = [
      { onEnd: (_ctx: null, end: End) => { seen.push(end); return []; } },
      { onEnd: (_ctx: null, end: End) => { seen.push(end); } },
    ];
    reduceBehaviorEnd(behaviors, null, { tag: 'mine' });
    expect(seen).toEqual([{ tag: 'mine', answered: false }, { tag: 'mine', answered: true }]);
  });

  it('runs the behaviors after one that throws, telling them the commit is decided, then rethrows the first error', () => {
    const later = vi.fn((_ctx: string, _end: BehaviorEnd) => []);
    const behaviors = [
      { onEnd: refuse },
      { onEnd: later },
      { onEnd: () => { throw new Error('second'); } },
    ];
    expect(() => reduceBehaviorEnd(behaviors, 'ctx')).toThrow('refused');
    expect(later).toHaveBeenCalledWith('ctx', { answered: true });
  });
});

describe('commitGestureOps — whether the commit landed', () => {
  type Pose = { x: number; y: number; width: number; height: number };
  const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };

  /** A loose leaf beside a container whose arrivals `arrive` decides. */
  function target(arrive: 'takes' | 'refuses', applyOps?: (ops: Op[], label: string) => void) {
    const scene = createScene<unknown, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'group', id: asNodeId('box'), layer: 'main', pose: POSE, data: null });
    scene.add({ kind: 'mark', id: asNodeId('loose'), layer: 'main', pose: POSE, data: null });
    scene.setArrivalHandler(() => (arrive === 'refuses' ? null : new Map()));
    return { scene, at: { scene: scene as never, applyOps, adapter: moveGestureAdapter(scene) } };
  }
  const into = (): Op[] => [createReparentOp({ id: 'loose', fromParentId: null, toParentId: 'box' })];
  const recorded = () => readGestureLifecycle({}, 'Test');
  const transient = () => readGestureLifecycle({ transient: true }, 'Test');

  it('is true for a batch that lands, recorded or transient, and for an empty one', () => {
    expect(commitGestureOps(target('takes').at, recorded(), into())).toBe(true);
    expect(commitGestureOps(target('takes').at, transient(), into())).toBe(true);
    expect(commitGestureOps(target('takes').at, recorded(), [])).toBe(true);
  });

  it('is false for a refused arrival the scene reverted and swallowed', () => {
    const { scene, at } = target('refuses');
    expect(commitGestureOps(at, recorded(), into())).toBe(false);
    expect(scene.get(asNodeId('loose'))!.parent).toBeNull();
  });

  it('is false, and does not throw, for a refused arrival on the transient route', () => {
    const { scene, at } = target('refuses');
    expect(commitGestureOps(at, transient(), into())).toBe(false);
    expect(scene.get(asNodeId('loose'))!.parent).toBeNull();
  });

  it('lets any other error out of the transient route', () => {
    const { at } = target('takes');
    const boom = [{ ...into()[0], apply: refuse }] as Op[];
    expect(() => commitGestureOps(at, transient(), boom)).toThrow('refused');
  });

  it('takes a consumer applyOps at its word', () => {
    const applyOps = vi.fn();
    expect(commitGestureOps(target('refuses', applyOps).at, recorded(), into())).toBe(true);
    expect(applyOps).toHaveBeenCalledTimes(1);
  });
});

describe('runBehaviorSettled', () => {
  it('runs the behaviors after one that throws, then rethrows the first error', () => {
    const later = vi.fn();
    const behaviors = [
      { onSettled: refuse },
      { onSettled: later },
      { onSettled: () => { throw new Error('second'); } },
    ];
    expect(() => runBehaviorSettled(behaviors, 'ctx', true)).toThrow('refused');
    expect(later).toHaveBeenCalledWith('ctx', true);
  });
});

describe('runBehaviorCancel', () => {
  it('runs the behaviors after one that throws, then rethrows the first error', () => {
    const later = vi.fn();
    const behaviors = [
      { onCancel: refuse },
      { onCancel: later },
      { onCancel: () => { throw new Error('second'); } },
    ];
    expect(() => runBehaviorCancel(behaviors, 'ctx')).toThrow('refused');
    expect(later).toHaveBeenCalledWith('ctx');
  });
});

describe('closeGesture', () => {
  function closing(onSettled: (ctx: string, committed: boolean) => void, onGestureEnd: (committed: boolean) => void) {
    const scene = createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const lifecycle = readGestureLifecycle({ onGestureEnd }, 'Test');
    lifecycle.start([]);
    return {
      hold: scene.overrides.hold(),
      previews: new Map(),
      behaviors: [{ onSettled }],
      ctx: 'ctx',
      lifecycle,
    };
  }

  it('still fires onGestureEnd when a behavior\'s onSettled throws', () => {
    const onGestureEnd = vi.fn();
    expect(() => closeGesture(closing(refuse, onGestureEnd), false)).toThrow('refused');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
