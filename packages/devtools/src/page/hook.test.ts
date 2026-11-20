import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import type { CanvasExtensionApi, ContributionDepReader } from '@weasel-js/core';
import { createDevtoolsHook, installDevtoolsHook } from './hook';
import { DEVTOOLS_PROTOCOL, type PageMessage } from './protocol';
import { createInPageTransports, createWindowPageTransport, createWindowPanelTransport } from './transport';
import { createDevtoolsRoot } from './root';
import { attachDevtools } from './attach';
import { connectDevtools } from '../client';

// Each test's hook serves the window through a listener of its own, which would answer the next test's panels too.
let served: EventListenerOrEventListenerObject[] = [];
beforeEach(() => {
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
    if (type === 'message') served.push(listener);
    add(type, listener, opts);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const l of served) window.removeEventListener('message', l);
  served = [];
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
  it('serves the later of two window panels, telling the earlier, and keeps it when the earlier says bye', async () => {
    const hook = installDevtoolsHook()!;
    const r = root();
    const off = hook.register(r);
    const a = connectDevtools(createWindowPanelTransport());
    await vi.waitFor(() => expect(a.state().status).toBe('connected'));
    const b = connectDevtools(createWindowPanelTransport());
    await vi.waitFor(() => expect(b.state().status).toBe('connected'));
    await vi.waitFor(() => expect(a.state()).toMatchObject({ status: 'error', error: /another devtools panel/ }));
    a.close();
    await expect(b.request(r.id, { type: 'get-state' })).resolves.toMatchObject({ activeTool: null });
    b.close();
    off();
    // The root-removed this posts is still queued (jsdom delivers posts in order); let it arrive before the next test.
    const mark = {};
    await new Promise<void>((resolve) => {
      const listen = (e: MessageEvent) => { if (e.data === mark) { window.removeEventListener('message', listen); resolve(); } };
      window.addEventListener('message', listen);
      window.postMessage(mark, '*');
    });
  });

  it('stops listening to a transport once its panel says bye', () => {
    const hook = createDevtoolsHook();
    const { page, panel } = createInPageTransports();
    let listening = 0;
    const counted: typeof page = {
      send: page.send,
      onMessage: (l) => { listening++; const off = page.onMessage(l); return () => { listening--; off(); }; },
    };
    hook.connect(counted);
    panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    panel.send({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
    expect(listening).toBe(0);
  });

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

  it('ignores a yo and requests posted by another frame', async () => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    const hook = installDevtoolsHook()!;
    const off = hook.register(root());
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const heard: PageMessage[] = [];
    const stop = createWindowPanelTransport().onMessage((m) => heard.push(m));
    const fromFrame = (message: unknown) => window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'weasel-devtools', side: 'panel', message }, source: frame.contentWindow,
    }));
    fromFrame({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    const page = createWindowPageTransport();
    const offPage = page.onMessage((m) => heard.push(m as never));
    fromFrame({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
    await settle();
    expect(heard).toEqual([]);
    stop(); offPage(); off(); frame.remove();
  });

  it('is installed by the first canvas that attaches, which it lists until the canvas detaches', () => {
    expect(window.__weaselDevtools__).toBeUndefined();
    const detach = attachDevtools(api, deps);
    expect(window.__weaselDevtools__?.roots()).toHaveLength(1);
    detach();
    expect(window.__weaselDevtools__?.roots()).toEqual([]);
  });
});
