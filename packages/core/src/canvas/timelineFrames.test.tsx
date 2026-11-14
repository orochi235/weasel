import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTarget } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { linear } from '@weasel-js/geom';
import type { RasterSession } from './renderSceneToPixels';
import { renderTimelineFrames, timelineFrameTimes, type SteppedTimeline } from './timelineFrames';

const ARGS = { scene: {}, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, scale: { x: 1, y: 1 } } as never;

/** A session whose renders read `probe` and answer it as the image's first byte. */
function fakeSession(probe: () => number = () => 0) {
  const render = vi.fn(() => ({ width: 1, height: 1, data: Uint8ClampedArray.of(probe(), 0, 0, 255) }));
  const dispose = vi.fn();
  return { session: { render, dispose } as unknown as RasterSession, render, dispose };
}

function fakeTimeline(duration = 1000, at = 250, paused = false) {
  const log: string[] = [];
  let t = at;
  let p = paused;
  const timeline: SteppedTimeline = {
    seek: (next) => { t = next; log.push(`seek ${String(next)}`); },
    time: () => t,
    duration: () => duration,
    pause: () => { p = true; log.push('pause'); },
    resume: () => { p = false; log.push('resume'); },
    isPaused: () => p,
  };
  return { timeline, log };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('timelineFrameTimes', () => {
  it('covers [from, to) at the rate, with the end added on request', () => {
    expect(timelineFrameTimes(0, 1000, 4)).toEqual([0, 250, 500, 750]);
    expect(timelineFrameTimes(0, 1000, 4, true)).toEqual([0, 250, 500, 750, 1000]);
    expect(timelineFrameTimes(0, 1000, 30)).toHaveLength(30);
    expect(timelineFrameTimes(0, 1000, 30, true).at(-1)).toBe(1000);
    expect(timelineFrameTimes(100, 1150, 10, true)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1150]);
    expect(timelineFrameTimes(0, 0, 30)).toEqual([0]);
  });
  it('refuses a rate or span that is not one', () => {
    expect(() => timelineFrameTimes(0, 1000, 0)).toThrow(RangeError);
    expect(() => timelineFrameTimes(0, 1000, Infinity)).toThrow(RangeError);
    expect(() => timelineFrameTimes(500, 100, 30)).toThrow(RangeError);
  });
});

describe('renderTimelineFrames', () => {
  it('pauses, seeks each frame in order before its render, and puts the playhead back playing', async () => {
    const { timeline, log } = fakeTimeline();
    const { session, render, dispose } = fakeSession(() => timeline.time() / 10);
    const progress: unknown[] = [];
    const frames = await collect(renderTimelineFrames({
      timeline, fps: 4, render: ARGS, session, onProgress: (p) => progress.push(p),
    }));
    expect(frames.map((f) => [f.index, f.time, f.image.data[0]])).toEqual([[0, 0, 0], [1, 250, 25], [2, 500, 50], [3, 750, 75]]);
    expect(log).toEqual(['pause', 'seek 0', 'seek 250', 'seek 500', 'seek 750', 'seek 250', 'resume']);
    expect(render).toHaveBeenCalledTimes(4);
    expect(progress).toEqual([0, 250, 500, 750].map((time, index) => ({ index, count: 4, time })));
    // A session handed in stays open.
    expect(dispose).not.toHaveBeenCalled();
  });

  it('renders a span of its own, with args per frame, and leaves a paused timeline paused', async () => {
    const { timeline, log } = fakeTimeline(1000, 0, true);
    const { session, render } = fakeSession();
    const args = vi.fn((_frame: { index: number; time: number }) => ARGS);
    await collect(renderTimelineFrames({ timeline, fps: 10, from: 200, to: 400, includeEnd: true, render: args, session }));
    expect(args.mock.calls.map(([f]) => f)).toEqual([{ index: 0, time: 200 }, { index: 1, time: 300 }, { index: 2, time: 400 }]);
    expect(render).toHaveBeenCalledTimes(3);
    expect(log.at(-1)).toBe('seek 0');
  });

  it('stops at an abort before the next frame, throwing its reason, and restores the timeline', async () => {
    const { timeline, log } = fakeTimeline();
    const { session, render } = fakeSession();
    const ac = new AbortController();
    const seen: number[] = [];
    const run = (async () => {
      for await (const f of renderTimelineFrames({ timeline, fps: 4, render: ARGS, session, signal: ac.signal })) {
        seen.push(f.index);
        if (f.index === 1) ac.abort(new Error('stop'));
      }
    })();
    await expect(run).rejects.toThrow('stop');
    expect(seen).toEqual([0, 1]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(log.slice(-2)).toEqual(['seek 250', 'resume']);
  });

  it('throws on an already-aborted signal without touching the timeline', async () => {
    const { timeline, log } = fakeTimeline();
    const { session } = fakeSession();
    const it = renderTimelineFrames({ timeline, fps: 4, render: ARGS, session, signal: AbortSignal.abort() });
    await expect(it.next()).rejects.toThrow();
    expect(log).toEqual([]);
  });

  it('restores the timeline when the caller stops iterating early', async () => {
    const { timeline, log } = fakeTimeline();
    const { session } = fakeSession();
    for await (const f of renderTimelineFrames({ timeline, fps: 4, render: ARGS, session })) {
      if (f.index === 0) break;
    }
    expect(log).toEqual(['pause', 'seek 0', 'seek 250', 'resume']);
  });

  it('renders what a real timeline shows at each frame', async () => {
    const { result } = renderHook(() => useAnimator({ requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 }));
    let shown = 0;
    let value = 0;
    const target = createTarget<number>({ get: () => value, set: (v) => { value = v; }, show: (v) => { shown = v; } });
    let tl!: ReturnType<typeof result.current.timeline>;
    act(() => {
      tl = result.current.timeline({
        tracks: [{ kind: 'sampled', target, keys: [{ t: 0, value: 0 }, { t: 1000, value: 200, easing: linear }] }],
      });
    });
    const { session } = fakeSession(() => shown);
    const frames = await collect(renderTimelineFrames({ timeline: tl, fps: 4, includeEnd: true, render: ARGS, session }));
    expect(frames.map((f) => f.image.data[0])).toEqual([0, 50, 100, 150, 200]);
    expect(tl.isPaused()).toBe(false);
    expect(tl.time()).toBe(0);
  });
});
