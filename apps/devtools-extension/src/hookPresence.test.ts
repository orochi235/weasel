import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionApi } from './browserApi';
import { isProbeRequest } from './envelope';
import { inspectedPresence, watchHookPresence } from './hookPresence';
import { answerProbe } from './tabWeasel';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function page() {
  const nav = new Set<() => void>();
  const state = { hook: false };
  return {
    state,
    navigate: () => { for (const l of [...nav]) l(); },
    opts: {
      probe: async () => state.hook,
      onNavigated: (l: () => void) => { nav.add(l); return () => { nav.delete(l); }; },
      delays: [0, 100, 200],
    },
  };
}

describe('watching for a hook in the inspected page', () => {
  it('reports a hook that is there from the start', async () => {
    const p = page();
    p.state.hook = true;
    const report = vi.fn();
    watchHookPresence(p.opts, report);
    await vi.advanceTimersByTimeAsync(0);
    expect(report.mock.calls).toEqual([[true]]);
  });

  it('reports absence once the checks run out, and the hook when it turns up later', async () => {
    const p = page();
    const report = vi.fn();
    watchHookPresence(p.opts, report);
    await vi.advanceTimersByTimeAsync(300);
    expect(report.mock.calls).toEqual([[false]]);
    p.state.hook = true;
    await vi.advanceTimersByTimeAsync(200);
    expect(report.mock.calls).toEqual([[false], [true]]);
  });

  it('drops the hook on navigation and looks again', async () => {
    const p = page();
    p.state.hook = true;
    const report = vi.fn();
    watchHookPresence(p.opts, report);
    await vi.advanceTimersByTimeAsync(0);
    p.navigate();
    await vi.advanceTimersByTimeAsync(0);
    expect(report.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('stops looking when stopped', async () => {
    const p = page();
    const report = vi.fn();
    const stop = watchHookPresence(p.opts, report);
    stop();
    p.state.hook = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(report).not.toHaveBeenCalled();
  });
});

describe('probing the inspected tab', () => {
  /** A devtools page inspecting tab 9 and a background whose `executeScript` answers `frames`, one result per frame. */
  function extension(frames: unknown[]) {
    const executeScript = vi.fn(async () => frames.map((result) => ({ result })));
    const background = { scripting: { executeScript } } as unknown as ExtensionApi;
    const sendMessage = (message: unknown) => new Promise<unknown>((respond) => {
      if (!answerProbe(background, message, respond)) respond(undefined);
    });
    const devtools = {
      runtime: { sendMessage },
      devtools: { inspectedWindow: { tabId: 9 }, network: { onNavigated: { addListener() {}, removeListener() {} } } },
    } as unknown as ExtensionApi;
    return { executeScript, probe: inspectedPresence(devtools).probe };
  }

  it('finds a hook that only an iframe has', async () => {
    const { executeScript, probe } = extension([null, { kitVersion: '1.0.0', roots: 1 }]);
    await expect(probe()).resolves.toBe(true);
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 9, allFrames: true } }));
  });

  it('answers absent when no frame has one', async () => {
    await expect(extension([null, null]).probe()).resolves.toBe(false);
  });

  it('leaves other messages to other listeners', () => {
    const respond = vi.fn();
    expect(answerProbe({} as ExtensionApi, { weaselDevtools: 'hello' }, respond)).toBe(false);
    expect(isProbeRequest({ weaselDevtools: 'probe', tabId: 9 })).toBe(true);
    expect(respond).not.toHaveBeenCalled();
  });
});
