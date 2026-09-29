import { describe, it, expect, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { resizeAction } from './resize';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { ResizePolicy } from '../depSchema';

type Pose = { x: number; y: number; width: number; height: number };

function setup(policy: Partial<ResizePolicy<unknown>>) {
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'rect' } });
  const recorded = () => scene.historyEntries().length - 1;
  const base = {
    world: { x: 100, y: 100 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => [a] as NodeId[] },
      scene: scene as unknown as Scene<unknown, string, unknown>,
      resizePolicy: { constraints: [], pointSnap: [], expandIds: (ids: string[]) => ids, ...policy },
    },
    drag: {
      start: { x: 100, y: 100 },
      current: { x: 100, y: 100 },
      delta: { x: 0, y: 0 },
      affordance: { kind: 'handle:bottom-right', anchor: { x: 'min', y: 'min' } },
    },
  } as unknown as InvocationCtx;
  const grown = {
    ...base,
    drag: { ...base.drag!, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } },
  } as InvocationCtx;
  return { scene, a, base, grown, recorded };
}

function invoker() {
  const inv = resizeAction.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  return inv;
}

function resize(s: ReturnType<typeof setup>, reason: 'commit' | 'cancel' = 'commit') {
  const handle = invoker().start(s.base, undefined);
  handle.onMove?.(s.grown);
  handle.onEnd?.(s.grown, reason);
}

describe('resizeAction — cancel', () => {
  it('Esc mid-drag lets a constraint withdraw what it published', () => {
    // The shape of an alignment-guide overlay: publish on move, withdraw on end.
    let active: string[] = [];
    const constraint = {
      onMove: () => { active = ['R']; return undefined; },
      onEnd: () => { active = []; return undefined; },
      onCancel: () => { active = []; },
    };
    const s = setup({ constraints: [constraint] as never });
    const handle = invoker().start(s.base, undefined);
    handle.onMove?.(s.grown);
    expect(active).toEqual(['R']);
    handle.onEnd?.(s.grown, 'cancel');
    expect(active).toEqual([]);
  });
});

describe('resizeAction — lifecycle via the resizePolicy dep', () => {
  it('label names the history entry', () => {
    const s = setup({ label: 'Stretch' });
    resize(s);
    expect(s.scene.historyEntries().at(-1)?.label).toBe('Stretch');
  });

  it('transient resizes without recording an undo entry', () => {
    const s = setup({ transient: true });
    resize(s);
    expect(s.scene.get(s.a)!.pose.width).toBe(150);
    expect(s.recorded()).toBe(0);
  });

  it('fires onGestureStart with the resized ids and onGestureEnd(true) on commit', () => {
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    const s = setup({ onGestureStart, onGestureEnd });
    resize(s);
    expect(onGestureStart).toHaveBeenCalledWith([s.a]);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('fires onGestureEnd(false) on cancel', () => {
    const onGestureEnd = vi.fn();
    const s = setup({ onGestureEnd });
    resize(s, 'cancel');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('a behavior onEnd returning ops commits those in place of the resize', () => {
    const s = setup({ constraints: [{ onEnd: () => [] }] as never });
    resize(s);
    expect(s.scene.get(s.a)!.pose.width).toBe(100);
  });
});
