import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta, story } from '../../story/define';
import type { CapturePayload } from '../../vite/capture/payload';
import type { FrameSetup } from '../FrameController';
import { mountCapture } from './mountCapture';

const FILE = '/repo/a.stories.tsx';
const ID = 'ui-a--only';

const payload: CapturePayload = {
  story: ID,
  isolate: false,
  config: {},
  state: null,
  globals: { mode: 'dark' },
  overrides: {},
  playhead: null,
  box: { width: 100, height: 50 },
  layout: 'padded',
  dpr: 1,
  lab: { globals: {}, mode: 'light' },
};

function mount(setup: FrameSetup = {}) {
  document.body.innerHTML = '<div id="root"></div>';
  mountCapture({
    index: [{ id: ID, title: 'ui/A', name: 'Only', exportName: 'Only', file: FILE }],
    importers: { [FILE]: async () => ({ default: meta({ title: 'ui/A' }), Only: story({ render: () => <p>only</p> }) }) },
    setup,
  });
  return window.__forgeCapture!;
}

// `render` waits on the story's effects, which an `act` scope holds back until the awaited promise settles.
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let wasAct: boolean | undefined;
beforeAll(() => {
  wasAct = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});
afterAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasAct;
});

afterEach(() => {
  delete window.__forgeCapture;
  for (const el of Array.from(document.head.querySelectorAll('[data-fg-globals], [data-fg-overrides]'))) el.remove();
  document.body.innerHTML = '';
});

describe('mountCapture', () => {
  it('resolves a render once the story has painted', async () => {
    const capture = mount();
    await capture.render(payload);
    expect(document.querySelector('[data-fg-capture]')?.textContent).toBe('only');
  });

  it('rejects a render with what throws outside the story’s own boundary', async () => {
    const capture = mount({
      applyGlobals: () => {
        throw new Error('the frame config broke');
      },
    });
    // React reports a caught error to the console as well; the rejection is what this asserts.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(capture.render(payload)).rejects.toThrow('the frame config broke');
    quiet.mockRestore();
  });

  it('rejects a story the index does not hold', async () => {
    const capture = mount();
    await expect(capture.render({ ...payload, story: 'ui-a--missing' })).rejects.toThrow('No story with id "ui-a--missing"');
  });
});
