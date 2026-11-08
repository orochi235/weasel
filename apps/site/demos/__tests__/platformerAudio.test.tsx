import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';

const engines: { disposed: boolean; resolveUnlock: () => void; gains: number[] }[] = [];

vi.mock('@weasel-js/audio', () => ({
  createAudioEngine: () => {
    let resolveUnlock!: () => void;
    const unlocked = new Promise<void>((r) => { resolveUnlock = r; });
    const record = { disposed: false, resolveUnlock, gains: [] as number[] };
    engines.push(record);
    return {
      state: () => (record.disposed ? 'closed' : 'running'),
      now: () => 0,
      unlock: () => unlocked,
      bus: () => ({ setGain: (v: number) => { if (record.disposed) record.gains.push(v); }, mute: () => {} }),
      dispose: () => { record.disposed = true; },
      setListener: () => {},
      activeVoices: () => 0,
    };
  },
  createPatternPlayer: () => {
    throw new Error('a pattern player was built on a disposed engine');
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
});
