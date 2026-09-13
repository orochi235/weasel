import { afterEach, describe, expect, it } from 'vitest';
import { meta, story } from '../story/define';
import { runStory } from './runStory';

const FILE = '/repo/x.stories.tsx';
const ROOT = '/repo';

function boom(): never {
  throw new Error('button missing');
}

const mod = {
  default: meta({ title: 'Test/Run' }),
  Plain: story({ render: () => null }),
  Failing: story({
    render: () => null,
    play: async () => boom(),
  }),
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('runStory', () => {
  it('runs a story that renders and has no play', async () => {
    await expect(runStory(mod, 'Plain', FILE, ROOT)).resolves.toBeUndefined();
    expect(document.body.children).toHaveLength(0);
  });

  it('names the load phase when the file has no such export', async () => {
    await expect(runStory(mod, 'Missing', FILE, ROOT)).rejects.toThrow(
      `load fault: ${FILE} has no story export "Missing"`,
    );
  });

  it('names the load phase when the module cannot be loaded as stories', async () => {
    const broken = Object.defineProperty({ default: { title: 'Test/Broken' } }, 'Plain', {
      enumerable: true,
      get: () => {
        throw new Error('export blew up');
      },
    });
    await expect(runStory(broken, 'Plain', FILE, ROOT)).rejects.toThrow('load fault: export blew up');
  });

  it('carries the play function’s stack when play fails', async () => {
    const error = await runStory(mod, 'Failing', FILE, ROOT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('play fault: button missing');
    expect((error as Error).stack).toContain('boom');
    expect(document.body.children).toHaveLength(0);
  });
});
