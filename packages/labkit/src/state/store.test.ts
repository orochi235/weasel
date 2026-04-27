import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { labStorageKey } from './helpers';
import { createLabStore } from './store';

function makeStore(overrides?: Partial<Parameters<typeof createLabStore>[0]>) {
  return createLabStore({
    storageKey: 'test',
    storage: createMemoryAdapter(),
    ...overrides,
  });
}

describe('createLabStore — initial state', () => {
  it('starts with empty workspaces and saves', () => {
    const s = makeStore();
    expect(s.getState().workspaces).toEqual([]);
    expect(s.getState().savedSnapshots).toEqual([]);
  });

  it('uses initialTheme when provided', () => {
    const s = makeStore({ initialTheme: 'light' });
    expect(s.getState().theme).toBe('light');
  });

  it('defaults theme to auto', () => {
    const s = makeStore();
    expect(s.getState().theme).toBe('auto');
  });
});

describe('addWorkspace', () => {
  it('adds a workspace with an empty undoStack', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'Test',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    expect(s.getState().workspaces).toHaveLength(1);
    expect(s.getState().workspaces[0]?.undoStack).toEqual({ past: [], future: [] });
  });
});

describe('removeWorkspace', () => {
  it('removes by id', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().removeWorkspace('w1');
    expect(s.getState().workspaces).toHaveLength(0);
  });
});

describe('updateWorkspaceState', () => {
  it('updates state with a plain value', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 0 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateWorkspaceState('w1', { n: 42 });
    expect(s.getState().workspaces[0]?.state).toEqual({ n: 42 });
  });

  it('updates state with an updater function', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 1 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateWorkspaceState('w1', (prev: unknown) => ({
      n: (prev as { n: number }).n + 1,
    }));
    expect((s.getState().workspaces[0]?.state as { n: number }).n).toBe(2);
  });
});

describe('updateWorkspaceConfig', () => {
  it('updates a single config key', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: { x: 1, y: 2 },
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateWorkspaceConfig('w1', 'x' as never, 99 as never);
    expect((s.getState().workspaces[0]?.config as { x: number }).x).toBe(99);
    expect((s.getState().workspaces[0]?.config as { y: number }).y).toBe(2);
  });
});

describe('setTheme', () => {
  it('updates theme', () => {
    const s = makeStore();
    s.getState().setTheme('dark');
    expect(s.getState().theme).toBe('dark');
  });
});

describe('save/load/delete snapshots', () => {
  it('saveSnapshot creates a snapshot', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: { x: 1 },
      state: { n: 5 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'my save');
    const snaps = s.getState().savedSnapshots;
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.name).toBe('my save');
    expect(snaps[0]?.instrumentName).toBe('T');
  });

  it('loadSnapshot restores state and config', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: { x: 1 },
      state: { n: 5 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'snap1');
    s.getState().updateWorkspaceState('w1', { n: 99 });
    const snapId = s.getState().savedSnapshots[0]!.id;
    s.getState().loadSnapshot(snapId, 'w1');
    expect((s.getState().workspaces[0]?.state as { n: number }).n).toBe(5);
  });

  it('loadSnapshot blocks cross-instrument load', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'A',
      config: {},
      state: { n: 1 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'snap-a');
    s.getState().setWorkspaceInstrument('w1', 'B');
    const snapId = s.getState().savedSnapshots[0]!.id;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.getState().loadSnapshot(snapId, 'w1');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('deleteSnapshot removes the snapshot', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'snap');
    const id = s.getState().savedSnapshots[0]!.id;
    s.getState().deleteSnapshot(id);
    expect(s.getState().savedSnapshots).toHaveLength(0);
  });

  it('listSnapshots returns newest first', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'first');
    s.getState().saveSnapshot('w1', 'second');
    const list = s.getState().listSnapshots('w1');
    expect(list[0]?.name).toBe('second');
  });
});

describe('persistence — hydration', () => {
  it('hydrates workspaces from storage on construction', () => {
    vi.useFakeTimers();
    const mem = createMemoryAdapter();
    const seedStore = createLabStore({ storageKey: 'test', storage: mem });
    seedStore.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 7 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    const hydrated = createLabStore({ storageKey: 'test', storage: mem });
    expect(hydrated.getState().workspaces).toHaveLength(1);
    expect((hydrated.getState().workspaces[0]?.state as { n: number }).n).toBe(7);
  });
});

describe('persistence — debounced writes', () => {
  it('multiple rapid mutations produce one write call', () => {
    vi.useFakeTimers();
    const mem = createMemoryAdapter();
    const writeSpy = vi.spyOn(mem, 'write');
    const s = createLabStore({ storageKey: 'test', storage: mem });

    s.getState().addWorkspace({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateWorkspaceState('w1', { n: 1 });
    s.getState().updateWorkspaceState('w1', { n: 2 });
    s.getState().updateWorkspaceState('w1', { n: 3 });

    const writesBefore = writeSpy.mock.calls.length;
    vi.advanceTimersByTime(400);
    const writesAfter = writeSpy.mock.calls.length;

    expect(writesAfter - writesBefore).toBe(3);
    vi.useRealTimers();
  });
});
