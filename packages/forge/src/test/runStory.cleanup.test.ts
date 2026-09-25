import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meta, story } from '../story/define';
import { runStory } from './runStory';

vi.mock('react-dom/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom/client')>();
  return { ...actual, createRoot: vi.fn(actual.createRoot) };
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
  Hanging: story({
    render: () => null,
    play: () => new Promise<void>(() => {}),
  }),
};

/** Mounts a real root, but makes its unmount throw after unmounting. */
async function unmountThrows() {
  const { createRoot: real } = await vi.importActual<typeof import('react-dom/client')>('react-dom/client');
  vi.mocked(createRoot).mockImplementationOnce((container, options) => {
    const root = real(container, options);
    // The root's methods live on its prototype, so a spread would lose them.
    return {
      render: (children) => root.render(children),
      unmount: () => {
        root.unmount();
        throw new Error('unmount broke');
      },
    };
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('runStory faults outside the story', () => {
  it('names the mount phase when the root cannot be created', async () => {
    vi.mocked(createRoot).mockImplementationOnce(() => {
      throw new Error('no root');
    });
    await expect(runStory(mod, 'Plain', FILE, 'Auto')).rejects.toThrow('mount fault: no root');
    expect(document.body.children).toHaveLength(0);
  });

  it('reports a failing unmount when the story itself passed, having still removed the container', async () => {
    await unmountThrows();
    const error = await runStory(mod, 'Plain', FILE, 'Auto').catch((e: unknown) => e);
    expect((error as Error).message).toBe('cleanup fault: unmount broke');
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect(document.body.children).toHaveLength(0);
  });

  it('throws the story’s own failure over a failing unmount', async () => {
    await unmountThrows();
    await expect(runStory(mod, 'Failing', FILE, 'Auto')).rejects.toThrow('play fault: play broke');
    expect(document.body.children).toHaveLength(0);
  });

  it('unmounts the story a timed-out run left behind when the next run starts', async () => {
    // Never settles: the test runner would have timed it out and moved on.
    void runStory(mod, 'Hanging', FILE, 'Auto');
    await vi.waitFor(() => expect(document.querySelector('.fg-story[data-fg-host]')).not.toBeNull());
    expect(document.body.children).toHaveLength(1);
    await expect(runStory(mod, 'Plain', FILE, 'Auto')).resolves.toBeUndefined();
    expect(document.body.children).toHaveLength(0);
  });
});
