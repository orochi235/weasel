import { act, cleanup, renderHook } from '@testing-library/react';
import { createClock } from '@weasel-js/clock';
import { afterEach, describe, expect, it } from 'vitest';
import type { EffectPipeline } from '../types';
import type { EffectEvaluators } from './types';
import { useEffectRunner } from './useEffectRunner';

const PIPELINE: EffectPipeline = { stages: [{ id: 't', title: 't', type: 'clock', outputs: [{ id: 'out', type: 'number' }] }], wires: [] };
const EVAL: EffectEvaluators = { clock: ({ time }) => ({ outputs: { out: time } }) };

/** A frame clock the test advances by hand. */
function fakeFrames() {
  let queued: FrameRequestCallback | null = null;
  return {
    requestFrame: (cb: FrameRequestCallback) => { queued = cb; return 1; },
    cancelFrame: () => { queued = null; },
    async fire(time: number) {
      const cb = queued;
      queued = null;
      await act(async () => { cb?.(time); await new Promise((r) => setTimeout(r, 0)); });
    },
  };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  cleanup();
  setHidden(false);
});

describe('useEffectRunner', () => {
  it('plays on its frame source, and leaves the time spent hidden off the clock', async () => {
    const frames = fakeFrames();
    const { result } = renderHook(() => useEffectRunner({ pipeline: PIPELINE, evaluators: EVAL, ...frames }));
    act(() => result.current.runner.play());
    await frames.fire(1000);
    await frames.fire(1100);
    expect(result.current.time).toBeCloseTo(0.1);
    expect(result.current.run?.stages.t?.values).toEqual({ out: '0.1' });

    act(() => setHidden(true));
    act(() => setHidden(false));
    await frames.fire(60_000);
    await frames.fire(60_100);
    expect(result.current.time).toBeCloseTo(0.2);

    act(() => result.current.runner.pause());
    await frames.fire(70_000);
    expect(result.current.time).toBeCloseTo(0.2);
  });

  it('plays on a clock when given one: its rate, seeks and frames move it, and play sets its rate', async () => {
    const frames = fakeFrames();
    const handle = createClock({});
    const { clock } = handle;
    const { result } = renderHook(() => useEffectRunner({ pipeline: PIPELINE, evaluators: EVAL, clock: handle, ...frames }));
    const sync = async (t: number) => {
      await act(async () => { clock.sync(t); await new Promise((r) => setTimeout(r, 0)); });
    };

    act(() => result.current.runner.play());
    expect(clock.rate).toBe(1);
    await sync(1000);
    await sync(1250);
    expect(result.current.time).toBeCloseTo(0.25);
    expect(result.current.run?.stages.t?.values).toEqual({ out: '0.25' });
    await frames.fire(5000);
    expect(result.current.time).toBeCloseTo(0.25);

    act(() => { clock.rate = 0; });
    expect(result.current.playing).toBe(false);
    act(() => clock.seek(4000));
    await sync(9000);
    expect(result.current.time).toBe(4);
    expect(result.current.run?.stages.t?.values).toEqual({ out: '4' });

    act(() => { clock.rate = 2; });
    expect(result.current.playing).toBe(true);
    act(() => result.current.runner.pause());
    expect(clock.rate).toBe(0);
  });
});
