import type { AudioEngine, AudioGraph } from '@weasel-js/audio';
import { createFakeAudioContext } from '@weasel-js/audio/testing/fakeAudioContext';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectPipeline } from '../types';
import type { AudioPreview } from './scope';
import { AUDIO_STAGE_TYPES } from './stageTypes';
import { useLiveAudioRunner } from './useLiveAudioRunner';

const OSC = AUDIO_STAGE_TYPES.find((t) => t.type === 'audio.oscillator')!;
const PIPELINE: EffectPipeline = {
  stages: [{ id: 'osc', title: 'osc', type: OSC.type, outputs: OSC.outputs, params: OSC.params }],
  wires: [],
};

const fakeEngine = () => {
  const graph = {
    apply: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    tap: vi.fn(() => ({ dispose: vi.fn() })),
  } as never as AudioGraph;
  return { context: createFakeAudioContext(), unlock: async () => {}, graph: () => graph } as never as AudioEngine;
};

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

afterEach(cleanup);

describe('useLiveAudioRunner', () => {
  it('draws a frame per visible frame while playing with previews on, and never with them off', async () => {
    const frames = fakeFrames();
    const engine = fakeEngine();
    const { result, rerender } = renderHook(
      ({ previews }: { previews: AudioPreview }) => useLiveAudioRunner({ engine, pipeline: PIPELINE, previews, ...frames }),
      { initialProps: { previews: 'scope' as AudioPreview } },
    );
    const frame = vi.spyOn(result.current.runner, 'frame').mockImplementation(() => {});
    await act(() => result.current.runner.play());
    await frames.fire(1);
    await frames.fire(2);
    expect(frame).toHaveBeenCalledTimes(2);

    rerender({ previews: 'off' });
    await frames.fire(3);
    await frames.fire(4);
    expect(frame).toHaveBeenCalledTimes(2);

    rerender({ previews: 'spectrum' });
    await frames.fire(5);
    expect(frame).toHaveBeenCalledTimes(3);

    act(() => result.current.runner.pause());
    await frames.fire(6);
    expect(frame).toHaveBeenCalledTimes(3);
  });

  it('disposes the runner on unmount', () => {
    const { result, unmount } = renderHook(() => useLiveAudioRunner({ engine: fakeEngine(), pipeline: PIPELINE, previews: 'off' }));
    const dispose = vi.spyOn(result.current.runner, 'dispose');
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
