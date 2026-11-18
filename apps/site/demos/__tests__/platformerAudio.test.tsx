import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';

const engines: { disposed: boolean; resolveUnlock: () => void; gains: number[]; mutes: boolean[] }[] = [];

vi.mock('@weasel-js/audio', () => ({
  createAudioEngine: () => {
    let resolveUnlock!: () => void;
    const unlocked = new Promise<void>((r) => { resolveUnlock = r; });
    const record = { disposed: false, resolveUnlock, gains: [] as number[], mutes: [] as boolean[] };
    engines.push(record);
    return {
      state: () => (record.disposed ? 'closed' : 'running'),
      now: () => 0,
      unlock: () => unlocked,
      bus: () => ({ setGain: (v: number) => { if (record.disposed) record.gains.push(v); }, mute: (m: boolean) => { record.mutes.push(m); } }),
      dispose: () => { record.disposed = true; },
      setListener: () => {},
      activeVoices: () => 0,
    };
  },
  createPatternPlayer: (engine: { state: () => string }) => {
    if (engine.state() === 'closed') throw new Error('a pattern player was built on a disposed engine');
    return { start: () => {}, stop: () => {} };
  },
}));

const { usePlatformerAudio } = await import('../platformer/usePlatformerAudio');

type Api = ReturnType<typeof usePlatformerAudio>;

function mount() {
  let api!: Api;
  function Harness() {
    api = usePlatformerAudio(useAnimator(), () => {});
    return null;
  }
  const view = render(<Harness />);
  return { api: () => api, unmount: view.unmount };
}

describe('usePlatformerAudio', () => {
  beforeEach(() => {
    engines.length = 0;
    vi.stubGlobal('AudioContext', class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does nothing when the unlock resolves after the demo has unmounted', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => { rejections.push(reason); };
    process.on('unhandledRejection', onRejection);
    try {
      const { api, unmount } = mount();
      act(() => api().enableAudio());
      unmount();
      expect(engines[0].disposed).toBe(true);
      engines[0].resolveUnlock();
      await new Promise((r) => setTimeout(r, 0));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('does not restore the music level on an engine disposed during a duck', async () => {
    vi.useFakeTimers();
    const { api, unmount } = mount();
    act(() => api().enableAudio());
    api().hooks.current.duck();
    unmount();
    vi.advanceTimersByTime(1000);
    expect(engines[0].gains).toEqual([]);
  });

  it('keeps the music off when it is switched off before the unlock resolves', async () => {
    const { api } = mount();
    act(() => api().enableAudio());
    act(() => api().toggleMusic());
    engines[0].resolveUnlock();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(api().musicOn).toBe(false);
    expect(engines[0].mutes.at(-1)).toBe(true);
  });
});
