import { describe, it, expect, vi } from 'vitest';
import {
  DEVTOOLS_PROTOCOL, createDevtoolsHook, createDevtoolsRoot, createInPageTransports,
  type DevtoolsRootSource, type PageMessage, type PanelMessage, type PanelTransport,
} from '@weasel-js/core/devtools';
import { createDispatchTrace, createTraceRing } from '@weasel-js/core/routing';
import { connectDevtools, createDevtoolsClient } from './client';
import { createInPagePanelTransport } from './inPageTransport';
import { followTrace } from './trace';

function setup() {
  const trace = createDispatchTrace(10, false);
  const coords = createTraceRing<never>(10, false);
  let tool: string | null = 'select';
  const source: DevtoolsRootSource = {
    label: () => 'board',
    dimension: '2d',
    scene: () => null,
    selection: () => [],
    select: () => {},
    view: () => ({ x: 0, y: 0 }),
    activeTool: () => tool,
    tools: () => ['select', 'rect'],
    setTool: (id) => { tool = id; },
    trace,
    coords,
    frame: () => null,
    overlays: () => null,
    setOverride: () => {},
  };
  const root = createDevtoolsRoot(source);
  let flush: (() => void) | null = null;
  const hook = createDevtoolsHook({ schedule: (f) => { flush = f; } });
  const unregister = hook.register(root);
  const { page, panel } = createInPageTransports();
  const close = hook.connect(page);
  const sent: PanelMessage[] = [];
  const spy: PanelTransport = {
    send: (m) => { sent.push(m); panel.send(m); },
    onMessage: (l) => panel.onMessage(l),
  };
  return {
    root, hook, trace, coords, unregister, close, sent, transport: spy,
    flush: () => { const f = flush; flush = null; f?.(); },
    get tool() { return tool; },
  };
}

describe('connectDevtools', () => {
  it('says yo, and holds the roots and kit version sup names', () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    expect(t.sent[0]).toEqual({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    expect(client.state()).toMatchObject({
      status: 'connected', roots: [{ id: t.root.id, label: 'board', dimension: '2d' }],
    });
    expect(client.state().kitVersion).toEqual(expect.any(String));
  });

  it('tracks roots that come and go, telling subscribers each time', () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    const heard = vi.fn();
    client.subscribe(heard);
    t.unregister();
    expect(client.state().roots).toEqual([]);
    t.hook.register(t.root);
    expect(client.state().roots).toMatchObject([{ id: t.root.id }]);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('answers each request with its own result, numbering them', async () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    const state = await client.request(t.root.id, { type: 'get-state' });
    expect(state).toMatchObject({ activeTool: 'select', tools: ['select', 'rect'] });
    await client.request(t.root.id, { type: 'set-tool', toolId: 'rect' });
    expect(t.tool).toBe('rect');
    const ids = t.sent.filter((m) => 'requestId' in m).map((m) => (m as { requestId: number }).requestId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects a request the page refuses, with its message', async () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    await expect(client.request(t.root.id, { type: 'set-tool', toolId: 'lasso' })).rejects.toThrow('no tool "lasso"');
    await expect(client.request('root-x', { type: 'get-state' })).rejects.toThrow('no root "root-x"');
  });

  it('passes on the areas a changed notice names, for the root it names', () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    const heard = vi.fn();
    client.onChanged(heard);
    t.root.notify('selection');
    t.root.notify('tool');
    t.flush();
    expect(heard).toHaveBeenCalledWith(t.root.id, ['selection', 'tool']);
  });

  it('says bye on close, rejects what is still pending, and refuses more', async () => {
    const sent: PanelMessage[] = [];
    const transport: PanelTransport = { send: (m) => sent.push(m), onMessage: () => () => {} };
    const client = connectDevtools(transport);
    expect(client.state().status).toBe('connecting');
    const pending = client.request('root-1', { type: 'get-state' });
    client.close();
    expect(sent.at(-1)).toEqual({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
    await expect(pending).rejects.toThrow(/closed/);
    await expect(client.request('root-1', { type: 'get-state' })).rejects.toThrow(/closed/);
    expect(client.state().status).toBe('closed');
  });

  it('sends nothing until opened, and connects again when opened after a close', async () => {
    const t = setup();
    const inner = createInPagePanelTransport(t.hook);
    const sent: PanelMessage[] = [];
    const client = createDevtoolsClient({ send: (m) => { sent.push(m); inner.send(m); }, onMessage: inner.onMessage });
    expect(sent).toEqual([]);
    client.open();
    client.close();
    client.open();
    expect(sent.map((m) => m.type)).toEqual(['yo', 'bye', 'yo']);
    expect(client.state().status).toBe('connected');
    await expect(client.request(t.root.id, { type: 'get-state' })).resolves.toMatchObject({ activeTool: 'select' });
  });

  it('reports a page that speaks another protocol', () => {
    let deliver: (m: PageMessage) => void = () => {};
    const transport: PanelTransport = { send: () => {}, onMessage: (l) => { deliver = l; return () => {}; } };
    const client = connectDevtools(transport);
    deliver({ type: 'error', protocol: 2, requestId: null, message: 'protocol mismatch: the page speaks 2, the panel 1' });
    expect(client.state()).toMatchObject({ status: 'error', error: /protocol mismatch/ });
  });
});

describe('followTrace', () => {
  it('hands back only what was traced since the last read, with coords once asked for', async () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    const follower = followTrace(client, t.root.id);
    t.trace.recordModeSwitch('m', null, 'a');
    expect((await follower.read()).entries).toMatchObject([{ kind: 'mode', to: 'a' }]);
    expect((await follower.read()).entries).toEqual([]);
    t.trace.recordModeSwitch('m', 'a', 'b');
    t.coords.push({ ts: 1 } as never);
    const slice = await follower.read();
    expect(slice.entries).toMatchObject([{ to: 'b' }]);
    expect(slice.coords).toBeUndefined();
    follower.setCoords(true);
    t.coords.push({ ts: 2 } as never);
    expect((await follower.read()).coords).toMatchObject([{ ts: 1 }, { ts: 2 }]);
    expect((await follower.read()).coords).toEqual([]);
  });

  it('reads one at a time, so two reads never hand back the same entries', async () => {
    const t = setup();
    const client = connectDevtools(t.transport);
    const follower = followTrace(client, t.root.id);
    t.trace.recordModeSwitch('m', null, 'a');
    const [a, b] = await Promise.all([follower.read(), follower.read()]);
    expect([...a.entries, ...b.entries]).toHaveLength(1);
  });
});
