import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

let unlocked!: () => void;
const start = vi.fn();
vi.mock('@weasel-js/audio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/audio')>();
  return {
    ...real,
    createAudioEngine: () => ({
      unlock: () => new Promise<void>((resolve) => { unlocked = resolve; }),
      dispose: () => {},
    }),
    createScore: () => ({ start, stop: () => {}, isPlaying: () => false, setMood: () => {} }),
  };
});

const { ScoreDemo } = await import('../ScoreDemo');

describe('ScoreDemo', () => {
  it('starts no score on the engine it disposed when it unmounts while audio unlocks', async () => {
    vi.stubGlobal('AudioContext', class {});
    try {
      const { getByRole, unmount } = render(<ScoreDemo />);
      fireEvent.click(getByRole('button', { name: 'play' }));
      unmount();
      await act(async () => { unlocked(); });
      expect(start).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
