import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { moveAction } from './move';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import type { NodeId, Scene } from 'core/scene/types';
import type { MoveBehavior } from '../../gestures/types';
import { alignMoveBehavior } from 'features/guides/alignment/behaviors';
import type { Guide } from 'features/guides/types';

type Pose = { x: number; y: number; width: number; height: number };

function setup(selected: 'a' | 'ab' = 'a') {
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 50, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  const ids = selected === 'a' ? [a] : [a, b];
  // The adds above are undo entries of their own; count from here.
  const recorded = () => scene.historyEntries().length - 2;
  const base = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ids as NodeId[] },
      scene: scene as unknown as Scene<unknown, string, unknown>,
    } as Record<string, unknown>,
  };
  return { scene, a, b, base, recorded };
}

function frame(base: object, dx: number, screen = dx): InvocationCtx {
  return {
    ...base,
    drag: {
      start: { x: 0, y: 0 },
      current: { x: dx, y: 0 },
      delta: { x: dx, y: 0 },
      screenDelta: { x: screen, y: 0 },
    },
  } as InvocationCtx;
}

function invoker() {
  const inv = moveAction.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  return inv;
}

function drag(base: object, opts: BindingOpts | undefined, dx: number, reason: 'commit' | 'cancel' = 'commit') {
  const handle = invoker().start(base as InvocationCtx, opts);
  handle.onMove?.(frame(base, dx));
  handle.onEnd?.(frame(base, dx), reason);
  return handle;
}

describe('moveAction — label', () => {
  it('params.label names the history entry', () => {
    const { scene, base } = setup();
    drag(base, { params: { label: 'Nudge by hand' } }, 5);
    expect(scene.historyEntries().at(-1)?.label).toBe('Nudge by hand');
  });

  it('defaults to "Move"', () => {
    const { scene, base } = setup();
    drag(base, undefined, 5);
    expect(scene.historyEntries().at(-1)?.label).toBe('Move');
  });

  it('a behavior commit keeps its own op label when params.label is unset', () => {
    const { scene, a, base } = setup();
    const behavior: MoveBehavior<unknown> = {
      onEnd: () => [createTransformOp<Pose>({
        id: a as string,
        from: { x: 0, y: 0, width: 10, height: 10 },
        to: { x: 1, y: 1, width: 10, height: 10 },
        label: 'Snap',
      })],
    };
    drag(base, { behaviors: [behavior] }, 5);
    expect(scene.historyEntries().at(-1)?.label).toBe('Snap');
  });
});

describe('moveAction — transient', () => {
  it('params.transient moves the node without recording an undo entry', () => {
    const { scene, a, base, recorded } = setup();
    drag(base, { params: { transient: true } }, 5);
    expect(scene.get(a)!.pose).toEqual({ x: 5, y: 0, width: 10, height: 10 });
    expect(recorded()).toBe(0);
  });

  it('bypasses the consumer applyOps hook', () => {
    const { scene, a, base } = setup();
    const applyOps = vi.fn();
    drag({ ...base, deps: { ...base.deps, applyOps } }, { params: { transient: true } }, 5);
    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.get(a)!.pose.x).toBe(5);
  });

  it('a behavior with defaultTransient makes the gesture transient when params.transient is unset', () => {
    const { scene, a, base, recorded } = setup();
    drag(base, { behaviors: [{ defaultTransient: true }] }, 5);
    expect(scene.get(a)!.pose.x).toBe(5);
    expect(recorded()).toBe(0);
  });

  it('params.transient: false overrides a behavior default', () => {
    const { base, recorded } = setup();
    drag(base, { behaviors: [{ defaultTransient: true }], params: { transient: false } }, 5);
    expect(recorded()).toBe(1);
  });
});

describe('moveAction — onGestureStart / onGestureEnd', () => {
  it('fires start with the moved ids once the drag engages, and end(true) on commit', () => {
    const { a, b, base } = setup('ab');
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const handle = invoker().start(base as InvocationCtx, { params: { onGestureStart, onGestureEnd } });
    expect(onGestureStart).not.toHaveBeenCalled();
    handle.onMove!(frame(base, 5));
    handle.onMove!(frame(base, 6));
    expect(onGestureStart).toHaveBeenCalledTimes(1);
    expect(onGestureStart).toHaveBeenCalledWith([a, b]);
    handle.onEnd!(frame(base, 6), 'commit');
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('fires end(false) on cancel', () => {
    const { base } = setup();
    const onGestureEnd = vi.fn();
    drag(base, { params: { onGestureEnd } }, 5, 'cancel');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('fires end(false) when a behavior aborts the commit', () => {
    const { base } = setup();
    const onGestureEnd = vi.fn();
    drag(base, { behaviors: [{ onEnd: () => null }], params: { onGestureEnd } }, 5);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('fires neither when the drag never reaches its threshold', () => {
    const { base } = setup();
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const handle = invoker().start(base as InvocationCtx, {
      params: { onGestureStart, onGestureEnd, dragThresholdPx: 50 },
    });
    handle.onMove!(frame(base, 5));
    handle.onEnd!(frame(base, 5), 'commit');
    expect(onGestureStart).not.toHaveBeenCalled();
    expect(onGestureEnd).not.toHaveBeenCalled();
  });
});

describe('moveAction — expandIds', () => {
  it('moves the ids expandIds returns in place of the selection', () => {
    const { scene, a, b, base, recorded } = setup();
    const expandIds = (ids: string[]) => [...ids, b as string];
    drag(base, { params: { expandIds } }, 5);
    expect(scene.get(a)!.pose.x).toBe(5);
    expect(scene.get(b)!.pose.x).toBe(55);
    expect(recorded()).toBe(1);
  });

  it('an empty expansion declines the gesture', () => {
    const { base } = setup();
    expect(invoker().start(base as InvocationCtx, { params: { expandIds: () => [] } })).toEqual({});
  });
});

describe('moveAction — preview overrides', () => {
  it('a behavior abort drops the preview overrides it published', () => {
    const { scene, a, base } = setup();
    drag(base, { behaviors: [{ onEnd: () => null }] }, 5);
    expect(scene.overrides.has(a)).toBe(false);
  });

  it('a behavior commit drops the preview overrides it published', () => {
    const { scene, a, base } = setup();
    drag(base, { behaviors: [{ onEnd: () => [] }] }, 5);
    expect(scene.overrides.has(a)).toBe(false);
  });
});

describe('moveAction — cancel', () => {
  it('runs each behavior\'s onCancel, not its onEnd', () => {
    const { base } = setup();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    drag(base, { behaviors: [{ onEnd, onCancel }] }, 5, 'cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('Esc mid-drag clears the alignment guides it published', () => {
    const { base } = setup();
    let active: readonly Guide[] = [];
    const align = alignMoveBehavior({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 16 }],
      setActiveGuides: (g) => { active = g; },
    });
    const handle = invoker().start(base as InvocationCtx, { behaviors: [align] });
    handle.onMove?.(frame(base, 5));
    expect(active.map((g) => g.id)).toEqual(['L']);
    handle.onEnd?.(frame(base, 5), 'cancel');
    expect(active).toEqual([]);
  });
});
