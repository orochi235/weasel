import { f } from '@weasel-js/labkit/config';
import { createElement, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meta, story } from '../story/define';
import { runStory } from './runStory';

const FILE = '/repo/x.stories.tsx';
const AUTO_TITLE = 'Auto';

function boom(): never {
  throw new Error('button missing');
}

/** A story writing its own config on mount: the trial has to re-render it, and play has to see the write. */
function Renamer({ label, setConfig }: { label: string; setConfig: (path: string, value: unknown) => void }) {
  useEffect(() => {
    if (label !== 'renamed') setConfig('label', 'renamed');
  }, [label, setConfig]);
  return createElement('button', { type: 'button' }, label);
}

const mod = {
  default: meta({ title: 'Test/Run' }),
  Plain: story({ render: () => null }),
  Seen: story({
    config: f.schema({ label: f.string('hello') }),
    render: ({ config, setConfig }) => createElement(Renamer, { label: config.label, setConfig }),
    play: async ({ canvasElement, config }) => {
      if (!canvasElement.matches('.fg-story[data-fg-host]')) throw new Error(`canvasElement is ${canvasElement.className}`);
      if (!canvasElement.isConnected) throw new Error('canvasElement is not in the document');
      const button = canvasElement.querySelector('button');
      if (button?.textContent !== 'renamed') throw new Error(`button reads "${button?.textContent}"`);
      if (config.label !== 'renamed') throw new Error(`config.label is "${config.label}"`);
    },
  }),
  Throwing: story({
    render: () => {
      throw new Error('render broke');
    },
  }),
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

  it('renders the story in the page, and plays it against its host with the config it wrote', async () => {
    await expect(runStory(mod, 'Seen', FILE, AUTO_TITLE)).resolves.toBeUndefined();
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

  it("names the mount phase when the setup's prepare fails", async () => {
    const prepare = async () => {
      throw new Error('font missing');
    };
    await expect(runStory(mod, 'Plain', FILE, AUTO_TITLE, { setup: { prepare } })).rejects.toThrow('mount fault: font missing');
    expect(document.body.children).toHaveLength(0);
  });

  it('names the render phase when the story throws while rendering', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(runStory(mod, 'Throwing', FILE, AUTO_TITLE)).rejects.toThrow('render fault: render broke');
    } finally {
      spy.mockRestore();
    }
    expect(document.body.children).toHaveLength(0);
  });

  it('carries the play function’s stack when play fails', async () => {
    const error = await runStory(mod, 'Failing', FILE, AUTO_TITLE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('play fault: button missing');
    expect((error as Error).stack).toContain('boom');
    expect(document.body.children).toHaveLength(0);
  });
});
