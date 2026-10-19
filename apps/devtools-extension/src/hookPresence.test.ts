import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { watchHookPresence } from './hookPresence';

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
