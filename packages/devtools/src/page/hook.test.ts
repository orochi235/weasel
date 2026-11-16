import { describe, it, expect, afterEach } from 'vitest';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import type { CanvasExtensionApi, ContributionDepReader } from '@weasel-js/core';
import { installDevtoolsHook } from './hook';
import { DEVTOOLS_PROTOCOL, type PageMessage } from './protocol';
import { createWindowPanelTransport } from './transport';
import { createDevtoolsRoot } from './root';
import { attachDevtools } from './attach';

afterEach(() => {
  delete window.__weaselDevtools__;
});

const root = () => createDevtoolsRoot({
  label: () => 'c',
  dimension: '2d',
  scene: () => null,
  selection: () => [],
  select: () => {},
  view: () => null,
  activeTool: () => null,
  tools: () => [],
  setTool: () => {},
  trace: createDispatchTrace(),
  coords: createTraceRing(),
  frame: () => null,
  overlays: () => null,
  setOverride: () => {},
});

/** A surface with no inspection and no deps: what `attach` reads before a canvas has published any. */
const api = { element: null, getView: () => null, subscribeView: () => () => {}, getDebug: () => null } as unknown as CanvasExtensionApi;
const deps: ContributionDepReader = { get: () => undefined };

describe('the devtools hook', () => {
  it('answers a yo posted to the window, the way a content script sends one', async () => {
    const hook = installDevtoolsHook()!;
    const off = hook.register(root());
    const panel = createWindowPanelTransport();
    const sup = new Promise<PageMessage>((resolve) => {
      const stop = panel.onMessage((m) => { stop(); resolve(m); });
    });
    panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    expect(await sup).toMatchObject({ type: 'sup', roots: [{ label: 'c' }] });
    panel.send({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
    off();
  });

  it('is installed by the first canvas that attaches, which it lists until the canvas detaches', () => {
    expect(window.__weaselDevtools__).toBeUndefined();
    const detach = attachDevtools(api, deps);
    expect(window.__weaselDevtools__?.roots()).toHaveLength(1);
    detach();
    expect(window.__weaselDevtools__?.roots()).toEqual([]);
  });
});
