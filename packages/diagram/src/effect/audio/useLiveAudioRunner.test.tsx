import type { AudioEngine, AudioGraph } from '@weasel-js/audio';
import { createFakeAudioContext } from '@weasel-js/audio/testing/fakeAudioContext';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectPipeline } from '../types';
import type { AudioPreview } from './scope';
import { AUDIO_STAGE_TYPES } from './stageTypes';
import { useFollowAudioRunner } from './useFollowAudioRunner';
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
    await waitFor(() => expect(result.current.runner).not.toBeNull());
    const runner = result.current.runner!;
    const frame = vi.spyOn(runner, 'frame').mockImplementation(() => {});
    await act(() => runner.play());
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

    act(() => runner.pause());
    await frames.fire(6);
    expect(frame).toHaveBeenCalledTimes(3);
  });

  it('disposes the runner on unmount', async () => {
    const engine = fakeEngine();
    const { result, unmount } = renderHook(() => useLiveAudioRunner({ engine, pipeline: PIPELINE, previews: 'off' }));
    await waitFor(() => expect(result.current.runner).not.toBeNull());
    const dispose = vi.spyOn(result.current.runner!, 'dispose');
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('plays under StrictMode, leaving one graph undisposed', async () => {
    const graphs: { start: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = [];
    const engine = {
      context: createFakeAudioContext(),
      unlock: async () => {},
      graph: () => {
        const g = { apply: vi.fn(), start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), tap: vi.fn(() => ({ dispose: vi.fn() })) };
        graphs.push(g);
        return g as never as AudioGraph;
      },
    } as never as AudioEngine;
    const { result } = renderHook(() => useLiveAudioRunner({ engine, pipeline: PIPELINE, previews: 'off' }), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.runner).not.toBeNull());
    await act(() => result.current.runner!.play());
    const live = graphs.filter((g) => g.dispose.mock.calls.length === 0);
    expect(live).toHaveLength(1);
    expect(live[0]!.start).toHaveBeenCalledOnce();
  });

  it('makes a new runner on a new engine and disposes the old one', async () => {
    const { result, rerender } = renderHook(
      ({ engine }: { engine: AudioEngine }) => useLiveAudioRunner({ engine, pipeline: PIPELINE, previews: 'off' }),
      { initialProps: { engine: fakeEngine() } },
    );
    await waitFor(() => expect(result.current.runner).not.toBeNull());
    const first = result.current.runner!;
    const dispose = vi.spyOn(first, 'dispose');
    rerender({ engine: fakeEngine() });
    await waitFor(() => expect(result.current.runner).not.toBe(first));
    expect(dispose).toHaveBeenCalledOnce();
    expect(result.current.runner).not.toBeNull();
  });
});

describe('useFollowAudioRunner', () => {
  it('holds the plan\'s errors while there is no runner', () => {
    const FILE = AUDIO_STAGE_TYPES.find((t) => t.type === 'audio.file')!;
    const OUT = AUDIO_STAGE_TYPES.find((t) => t.type === 'audio.output')!;
    const pipeline: EffectPipeline = {
      stages: [
        { id: 'file', title: 'file', type: FILE.type, outputs: FILE.outputs },
        { id: 'out', title: 'out', type: OUT.type, inputs: OUT.inputs },
      ],
      wires: [{ from: { stage: 'file', port: 'out' }, to: { stage: 'out', port: 'in' } }],
    };
    const { result } = renderHook(() => useFollowAudioRunner(null, { pipeline, previews: 'off' }));
    expect(result.current).toEqual({ run: { stages: { file: { error: 'no source audio' } } }, playing: false });
  });
});
