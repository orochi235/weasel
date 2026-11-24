// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileEventsArrive, warnWhenWatchIsSilent, watchProbe, type WatchDir } from './watchProbe';
import { watchRecovery } from './watchRecovery';

/** A directory watch that reports nothing until the test calls `report`. */
function fakeWatch() {
  const state = { dir: '', closed: 0, report: () => {} };
  const watch: WatchDir = (dir, onEvent) => {
    state.dir = dir;
    state.report = onEvent;
    return () => {
      state.closed++;
    };
  };
  return { state, watch };
}

describe('fileEventsArrive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers true once the watch reports the write, and leaves no watch or directory behind', async () => {
    const { state, watch } = fakeWatch();
    const arrived = fileEventsArrive({ watch, waitMs: 5000 });
    expect(existsSync(join(state.dir, 'probe'))).toBe(true);
    state.report();
    await expect(arrived).resolves.toBe(true);
    expect(state.closed).toBe(1);
    expect(existsSync(state.dir)).toBe(false);
  });

  it('answers false when the wait passes with no report, and leaves no watch or directory behind', async () => {
    const { state, watch } = fakeWatch();
    const arrived = fileEventsArrive({ watch, waitMs: 5000 });
    await vi.advanceTimersByTimeAsync(4999);
    expect(existsSync(state.dir)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await expect(arrived).resolves.toBe(false);
    expect(state.closed).toBe(1);
    expect(existsSync(state.dir)).toBe(false);
  });

  it('writes again while it waits, since a watch misses a write made before it has started', async () => {
    const { state, watch } = fakeWatch();
    const arrived = fileEventsArrive({ watch, waitMs: 5000 });
    const first = readFileSync(join(state.dir, 'probe'), 'utf8');
    await vi.advanceTimersByTimeAsync(600);
    expect(readFileSync(join(state.dir, 'probe'), 'utf8')).not.toBe(first);
    state.report();
    await arrived;
  });

  it('answers false when the watch cannot start', async () => {
    const watch: WatchDir = () => {
      throw new Error('EMFILE');
    };
    await expect(fileEventsArrive({ watch, waitMs: 5000 })).resolves.toBe(false);
  });

  it('rejects, rather than throwing, when it cannot make its temp directory', async () => {
    vi.stubEnv('TMPDIR', '/no/such/forge-tmp');
    try {
      const arrived = fileEventsArrive({ watch: fakeWatch().watch, waitMs: 5000 });
      await expect(arrived).rejects.toThrow('ENOENT');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('warnWhenWatchIsSilent', () => {
  const serverWith = (watch: unknown, plugins: { name: string }[] = []) => {
    const warn = vi.fn();
    const server = { config: { server: { watch }, logger: { warn }, plugins } } as unknown as ViteDevServer;
    return { server, warn };
  };

  it('warns that edits will not be served when no file event arrives', async () => {
    const { server, warn } = serverWith(undefined);
    await warnWhenWatchIsSilent(server, async () => false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('usePolling');
  });

  it('claims a five-second wait only for its own probe, not for one it was handed', async () => {
    const { server, warn } = serverWith(undefined);
    await warnWhenWatchIsSilent(server, async () => false);
    expect(warn.mock.calls[0]?.[0]).not.toContain('5 s ago');
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[watch\] the watch probe found the OS file watcher reporting no changes, so/);
  });

  it('says edits are found by modification time instead when the server recovers missed events', async () => {
    const { server, warn } = serverWith(undefined, [watchRecovery()]);
    await warnWhenWatchIsSilent(server, async () => false);
    expect(warn.mock.calls[0]?.[0]).toContain('modification times');
    expect(warn.mock.calls[0]?.[0]).not.toContain('will not reach the page');
  });

  it('warns that it could not check, rather than rejecting, when the probe fails', async () => {
    const { server, warn } = serverWith(undefined);
    await warnWhenWatchIsSilent(server, async () => {
      throw new Error('ENOSPC');
    });
    expect(warn.mock.calls).toEqual([['[watch] could not check whether the OS file watcher reports changes: ENOSPC']]);
  });

  it('says nothing when the event arrives', async () => {
    const { server, warn } = serverWith(undefined);
    await warnWhenWatchIsSilent(server, async () => true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('probes a server once however many times it is asked', async () => {
    const { server, warn } = serverWith(undefined);
    const probe = vi.fn(async () => false);
    await Promise.all([warnWhenWatchIsSilent(server, probe), warnWhenWatchIsSilent(server, probe)]);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not probe a server that polls or does not watch', async () => {
    const probe = vi.fn(async () => false);
    for (const watch of [null, { usePolling: true }]) {
      const { server, warn } = serverWith(watch);
      await warnWhenWatchIsSilent(server, probe);
      expect(warn).not.toHaveBeenCalled();
    }
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('watchProbe', () => {
  it('is a serve-only plugin that warns from any dev server getting no file events', async () => {
    const warn = vi.fn();
    const server = { config: { server: { watch: undefined }, logger: { warn }, plugins: [] } } as unknown as ViteDevServer;
    const plugin = watchProbe({ probe: async () => false });
    expect(plugin.apply).toBe('serve');
    (plugin.configureServer as (server: ViteDevServer) => void)(server);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0]?.[0]).not.toContain('forge');
  });
});
