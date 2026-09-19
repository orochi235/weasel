import { afterEach, describe, expect, it } from 'vitest';
import { meta, story } from '../story/define';
import { runStory } from './runStory';

const FILE = '/repo/x.stories.tsx';
const AUTO_TITLE = 'Auto';

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
    await expect(runStory(mod, 'Plain', FILE, AUTO_TITLE)).resolves.toBeUndefined();
    expect(document.body.children).toHaveLength(0);
  });

  it("loads a CSF story under the setup's project parameters", async () => {
    const csf = {
      default: { title: 'Test/Csf' },
      Parametered: {
        render: (_args: unknown, { parameters }: { parameters: Record<string, unknown> }) => {
          if (parameters.project !== true) throw new Error('no project parameters');
          return null;
        },
      },
    };
    await expect(runStory(csf, 'Parametered', FILE, AUTO_TITLE, { setup: { parameters: { project: true } } })).resolves.toBeUndefined();
  });

  it('names the load phase when the file has no such export', async () => {
    await expect(runStory(mod, 'Missing', FILE, AUTO_TITLE)).rejects.toThrow(
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
    await expect(runStory(broken, 'Plain', FILE, AUTO_TITLE)).rejects.toThrow('load fault: export blew up');
  });

  it('carries the play function’s stack when play fails', async () => {
    const error = await runStory(mod, 'Failing', FILE, AUTO_TITLE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('play fault: button missing');
    expect((error as Error).stack).toContain('boom');
    expect(document.body.children).toHaveLength(0);
  });
});
