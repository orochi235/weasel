/**
 * A pose run and the canvas painting it, on one frame clock: the frame that
 * paints shows the poses the run produced for that same frame.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { createScene } from '../../core/scene/scene';
import type { NodeId, RectPose } from '../../core/scene/types';
import { effectivePose } from '../../core/scene/effectivePose';
import { useFrameLoop } from '../../canvas/useFrameLoop';
import { usePoseRun } from './usePoseRun';

const box = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

/** One clock both loops read: callbacks requested during a frame wait for the next, as rAF's do. */
function makeClock() {
  let next = 1;
  let now = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  return {
    requestFrame: (cb: FrameRequestCallback): number => {
      const h = next++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
    frame() {
      now += 16;
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const cb of due) cb(now);
    },
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('usePoseRun and the canvas frame loop', () => {
  it('paints each frame at the pose the run produced for that frame', () => {
    const clock = makeClock();
    vi.stubGlobal('requestAnimationFrame', clock.requestFrame);
    vi.stubGlobal('cancelAnimationFrame', clock.cancelFrame);
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const a: NodeId = scene.add({ kind: 'mark', layer: 'main', pose: box(0), data: {} });
    const produced: number[] = [];
    const painted: number[] = [];

    const { result } = renderHook(() => {
      // The canvas: repaints whenever an override moves, reading the pose as shown.
      const loop = useFrameLoop(() => {
        painted.push(effectivePose(scene, scene.get(a)!).x);
        return true;
      });
      useEffect(() => scene.overrides.subscribe(loop.requestRedraw), [loop.requestRedraw]);
      return usePoseRun<RectPose>({
        scene,
        step: ({ frame }) => {
          produced.push((frame + 1) * 10);
          return { poses: [[a, box((frame + 1) * 10)]], done: frame >= 5 };
        },
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      });
    });

    act(() => { result.current.start(); });
    for (let i = 0; i < 6; i++) {
      painted.length = 0;
      act(() => { clock.frame(); });
      // Once each frame, the first included, which no paint was scheduled for.
      expect(painted).toEqual([produced.at(-1)]);
    }
  });
});
