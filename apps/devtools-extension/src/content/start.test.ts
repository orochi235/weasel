import { describe, it, expect, vi } from 'vitest';
import type { ExtensionApi, PortLike } from '../browserApi';
import { portPair, type FakePort } from '../testing/fakePorts';
import { CONNECT_REQUEST, HELLO, PORT_PAGE } from '../envelope';
import { startContentScript, startContentScriptOnce, type BridgeScope } from './start';

/** A content script's view of the extension API, with the background's answer to its hello. */
function fakeApi(panelOpen: Promise<unknown>) {
  const listeners = new Set<(m: unknown, s: PortLike['sender'], r: (x?: unknown) => void) => void>();
  const ports: FakePort[] = [];
  const sent: unknown[] = [];
  const api = {
    runtime: {
      sendMessage: vi.fn((m: unknown) => { sent.push(m); return panelOpen; }),
      connect: ({ name }: { name: string }) => {
        const [local, remote] = portPair(name);
        ports.push(remote);
        return local;
      },
      onConnect: { addListener() {}, removeListener() {} },
      onMessage: {
        addListener: (l: never) => { listeners.add(l); },
        removeListener: (l: never) => { listeners.delete(l); },
      },
    },
  } as unknown as ExtensionApi;
  const ask = (m: unknown) => { for (const l of [...listeners]) l(m, undefined, () => {}); };
  return { api, ports, sent, ask };
}

const tick = () => new Promise((r) => setTimeout(r));

describe('the content script', () => {
  it('connects as it loads when its tab already has a panel', async () => {
    const f = fakeApi(Promise.resolve(true));
    startContentScript(f.api, window);
    await tick();
    expect(f.sent).toEqual([HELLO]);
    expect(f.ports.map((p) => p.name)).toEqual([PORT_PAGE]);
  });

  it('stays idle without a panel, until the background asks it to connect', async () => {
    const f = fakeApi(Promise.resolve(false));
    startContentScript(f.api, window);
    await tick();
    expect(f.ports).toEqual([]);
    f.ask(CONNECT_REQUEST);
    expect(f.ports).toHaveLength(1);
  });

  it('connects once when the hello and a connect request both say to', async () => {
    let answer!: (v: unknown) => void;
    const f = fakeApi(new Promise((r) => { answer = r; }));
    startContentScript(f.api, window);
    f.ask(CONNECT_REQUEST);
    answer(true);
    await tick();
    expect(f.ports).toHaveLength(1);
  });

  it('stays idle when the background cannot be reached', async () => {
    const f = fakeApi(Promise.reject(new Error('Could not establish connection')));
    startContentScript(f.api, window);
    await tick();
    expect(f.ports).toEqual([]);
  });

  it('connects again after its port goes, when asked', async () => {
    const f = fakeApi(Promise.resolve(true));
    startContentScript(f.api, window);
    await tick();
    f.ports[0]!.disconnect();
    f.ask(CONNECT_REQUEST);
    expect(f.ports).toHaveLength(2);
  });
});

describe('injecting the content script again', () => {
  it('starts once in a world a live copy already bridges', async () => {
    const f = fakeApi(Promise.resolve(true));
    (f.api.runtime as { id?: string }).id = 'ext';
    const scope: BridgeScope = {};
    startContentScriptOnce(f.api, window, scope);
    startContentScriptOnce(f.api, window, scope);
    await tick();
    expect(f.sent).toEqual([HELLO]);
  });

  it('starts again in a world a copy orphaned by an extension reload marked', async () => {
    const old = fakeApi(Promise.resolve(false));
    (old.api.runtime as { id?: string }).id = 'ext';
    const scope: BridgeScope = {};
    startContentScriptOnce(old.api, window, scope);
    delete (old.api.runtime as { id?: string }).id;
    const reloaded = fakeApi(Promise.resolve(true));
    (reloaded.api.runtime as { id?: string }).id = 'ext';
    startContentScriptOnce(reloaded.api, window, scope);
    await tick();
    expect(reloaded.ports.map((p) => p.name)).toEqual([PORT_PAGE]);
  });

  it('starts over a mark an older build left', async () => {
    const f = fakeApi(Promise.resolve(true));
    startContentScriptOnce(f.api, window, { __weaselDevtoolsBridge__: true });
    await tick();
    expect(f.sent).toEqual([HELLO]);
  });
});
