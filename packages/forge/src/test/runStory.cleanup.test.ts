import { afterEach, describe, expect, it, vi } from 'vitest';
import { startFrame } from '../frame/FrameController';
import { meta, story } from '../story/define';
import { runStory } from './runStory';

vi.mock('../frame/FrameController', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../frame/FrameController')>();
  return { ...actual, startFrame: vi.fn(actual.startFrame) };
});

const FILE = '/repo/x.stories.tsx';

const mod = {
  default: meta({ title: 'Test/Cleanup' }),
  Plain: story({ render: () => null }),
  Failing: story({
    render: () => null,
    play: async () => {
      throw new Error('play broke');
    },
  }),
};

/** Runs the real frame, but makes its stop function throw after stopping. */
async function stopThrows() {
  const { startFrame: real } = await vi.importActual<typeof import('../frame/FrameController')>('../frame/FrameController');
  vi.mocked(startFrame).mockImplementationOnce((options) => {
    const stop = real(options);
    return () => {
      stop();
      throw new Error('stop broke');
    };
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('runStory faults outside the frame', () => {
  it('names the mount phase when startFrame throws', async () => {
    vi.mocked(startFrame).mockImplementationOnce(() => {
      throw new Error('no root');
    });
    await expect(runStory(mod, 'Plain', FILE, 'Auto')).rejects.toThrow('mount fault: no root');
    expect(document.body.children).toHaveLength(0);
  });

  it('reports a failing stop when the story itself passed, having still removed the container', async () => {
    await stopThrows();
    const error = await runStory(mod, 'Plain', FILE, 'Auto').catch((e: unknown) => e);
    expect((error as Error).message).toBe('cleanup fault: stop broke');
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect(document.body.children).toHaveLength(0);
  });

  it('throws the story’s own failure over a failing stop', async () => {
    await stopThrows();
    await expect(runStory(mod, 'Failing', FILE, 'Auto')).rejects.toThrow('play fault: play broke');
    expect(document.body.children).toHaveLength(0);
  });
});
