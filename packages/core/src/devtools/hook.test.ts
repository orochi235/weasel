import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import { installDevtoolsHook } from './hook';
import { DEVTOOLS_PROTOCOL, type PageMessage } from './protocol';
import { createWindowPanelTransport } from './transport';
import { useDevtoolsRoot, type DevtoolsRootInputs } from './useDevtoolsRoot';

const dev = vi.hoisted(() => ({ on: true }));
vi.mock('@weasel-js/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/react')>()),
  isDev: () => dev.on,
}));

afterEach(() => {
  dev.on = true;
  delete window.__weaselDevtools__;
});

function inputs(): DevtoolsRootInputs {
  return {
    label: () => 'c',
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
    subscribeView: () => () => {},
  };
}

const mountRoot = () => renderHook(() => useDevtoolsRoot(inputs(), { selection: [], tool: null }));

describe('the devtools hook', () => {
  it('answers a yo posted to the window, the way a content script sends one', async () => {
    installDevtoolsHook();
    const root = mountRoot();
    const panel = createWindowPanelTransport();
    const sup = new Promise<PageMessage>((resolve) => {
      const off = panel.onMessage((m) => { off(); resolve(m); });
    });
    panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    expect(await sup).toMatchObject({ type: 'sup', roots: [{ label: 'c' }] });
    panel.send({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
    root.unmount();
  });

  it('is installed by a dev build and registers each canvas', () => {
    const root = mountRoot();
    expect(window.__weaselDevtools__?.roots()).toMatchObject([{ id: root.result.current.id }]);
    root.unmount();
    expect(window.__weaselDevtools__?.roots()).toEqual([]);
  });

  it('is left out of a production build unless the app installs it', () => {
    dev.on = false;
    const before = mountRoot();
    expect(window.__weaselDevtools__).toBeUndefined();
    before.unmount();
    installDevtoolsHook();
    const after = mountRoot();
    expect(window.__weaselDevtools__?.roots()).toMatchObject([{ id: after.result.current.id }]);
    after.unmount();
  });
});
