import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createResizeAction } from './action';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';

type Pose = { x: number; y: number; width: number; height: number };

function setup() {
  const scene = createScene<{ kind: string }, 'main', Pose>({ systemLayers: [{ id: 'main', visible: true, locked: false }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'rect' } });
  const onGestureEnd = vi.fn();
  const base = {
    world: { x: 100, y: 100 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => [a] as NodeId[] },
      scene,
      resizePolicy: { constraints: [], expandIds: (ids: string[]) => ids, onGestureEnd },
    },
    drag: {
      start: { x: 100, y: 100 }, current: { x: 100, y: 100 }, delta: { x: 0, y: 0 },
      affordance: { kind: 'handle:bottom-right', anchor: { x: 'min', y: 'min' } },
    },
  } as unknown as InvocationCtx;
  const grown = { ...base, drag: { ...base.drag!, current: { x: 150, y: 130 }, delta: { x: 50, y: 30 } } } as InvocationCtx;
  return { scene, a, base, grown, onGestureEnd };
}

function drag(action: ReturnType<typeof createResizeAction>, s: ReturnType<typeof setup>, reason: 'commit' | 'cancel') {
  const inv = action.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = inv.start(s.base, undefined);
  handle.onMove?.(s.grown);
  handle.onEnd?.(s.grown, reason);
}

describe('createResizeAction({ commit })', () => {
  it('hands the release poses to commit and writes nothing to the scene', () => {
    const s = setup();
    const commit = vi.fn();
    const entries = s.scene.historyEntries().length;
    drag(createResizeAction({ commit }), s, 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    const [poses, deps] = commit.mock.calls[0]!;
    expect([...poses]).toEqual([[s.a, { x: 0, y: 0, width: 150, height: 130 }]]);
    expect(deps.scene).toBe(s.scene);
    expect(s.scene.get(s.a)!.pose).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(s.scene.historyEntries()).toHaveLength(entries);
    expect(s.onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('is not called on cancel', () => {
    const s = setup();
    const commit = vi.fn();
    drag(createResizeAction({ commit }), s, 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });
});
