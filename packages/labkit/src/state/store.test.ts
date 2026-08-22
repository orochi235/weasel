import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { CURRENT_DOCUMENT_VERSION, labDocumentKey, quarantineKey } from './document';
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

  it('uses initialMode when provided', () => {
    const s = makeStore({ initialMode: 'light' });
    expect(s.getState().mode).toBe('light');
  });

  it('defaults mode to auto', () => {
    const s = makeStore();
    expect(s.getState().mode).toBe('auto');
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

describe('setMode', () => {
  it('updates mode', () => {
    const s = makeStore();
    s.getState().setMode('dark');
    expect(s.getState().mode).toBe('dark');
  });

  it('hydrates a stored interstellar preference as dark', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'theme'), 'interstellar');
    const s = createLabStore({ storageKey: 'test', storage });
    expect(s.getState().mode).toBe('dark');
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
    const snapId = s.getState().savedSnapshots[0]?.id ?? '';
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
    const snapId = s.getState().savedSnapshots[0]?.id ?? '';
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
    const id = s.getState().savedSnapshots[0]?.id ?? '';
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

    // One flush, one document.
    expect(writesAfter - writesBefore).toBe(1);
    vi.useRealTimers();
  });
});

describe('createLabStore — hydrating', () => {
  it('reads a current-version document', () => {
    const storage = createMemoryAdapter();
    storage.write(
      labDocumentKey('test'),
      JSON.stringify({
        version: CURRENT_DOCUMENT_VERSION,
        workspaces: [
          {
            id: 'w1',
            instrumentName: 'Test',
            config: {},
            state: {},
            view: { zoom: 2, pan: { x: 0, y: 0 } },
          },
        ],
        saves: [],
        layout: { w1: { h: 3 } },
        mode: 'dark',
      }),
    );

    const s = makeStore({ storage }).getState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].undoStack).toEqual({ past: [], future: [] });
    expect(s.layout).toEqual({ w1: { h: 3 } });
    expect(s.mode).toBe('dark');
  });

  it('folds the four legacy keys into state', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    const s = makeStore({ storage }).getState();
    expect(s.mode).toBe('dark');
  });

  it('honors initialMode when a folded legacy lab never set a theme', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));

    const s = makeStore({ storage, initialMode: 'dark' }).getState();
    expect(s.mode).toBe('dark');
  });

  it('starts empty and preserves a document from a future version', () => {
    const storage = createMemoryAdapter();
    const future = JSON.stringify({ version: 999, workspaces: [{ id: 'w1' }] });
    storage.write(labDocumentKey('test'), future);

    const store = makeStore({ storage });
    expect(store.getState().workspaces).toEqual([]);
    expect(storage.read(labDocumentKey('test'))).toBe(future);
  });

  it('quarantines a document that fails to parse', () => {
    const storage = createMemoryAdapter();
    storage.write(labDocumentKey('test'), '{{{not json');

    const s = makeStore({ storage }).getState();
    expect(s.workspaces).toEqual([]);
    expect(storage.read(quarantineKey('test'))).toBe('{{{not json');
  });
});

describe('createLabStore — flushing', () => {
  it('writes one document and no legacy keys', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
  });

  it('deletes the legacy keys once the folded document is written', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    const s = makeStore({ storage });
    s.getState().setMode('dark');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).not.toBeNull();
    expect(storage.read(labStorageKey('test', 'workspaces'))).toBeNull();
    expect(storage.read(labStorageKey('test', 'theme'))).toBeNull();
  });

  it('does not write when the stored document is from the future', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const future = JSON.stringify({ version: 999 });
    storage.write(labDocumentKey('test'), future);

    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).toBe(future);
  });

  it('keeps the legacy keys when the document write silently fails', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryAdapter();
    const write = storage.write.bind(storage);
    // A quota failure as localStorageAdapter reports one: swallowed, void.
    storage.write = (key, value) => {
      if (key === labDocumentKey('test')) return;
      write(key, value);
    };
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    const s = makeStore({ storage });
    s.getState().setMode('dark');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).toBeNull();
    expect(storage.read(labStorageKey('test', 'workspaces'))).toBe('[]');
    expect(storage.read(labStorageKey('test', 'theme'))).toBe('interstellar');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

const SNAPSHOT = {
  id: 's1',
  name: 'saved',
  workspaceId: 'w1',
  instrumentName: 'T',
  config: { x: 1 },
  state: { n: 5 },
  savedAt: 1000,
};

function writeDocument(
  storage: ReturnType<typeof createMemoryAdapter>,
  doc: Record<string, unknown>,
  storageKey = 'test',
): void {
  storage.write(
    labDocumentKey(storageKey),
    JSON.stringify({ version: CURRENT_DOCUMENT_VERSION, ...doc }),
  );
}

describe('createLabStore — labs whose keys once aliased', () => {
  it("keeps a document out of a sibling lab's legacy bucket", () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();

    // Lab "a:saves" writes where lab "a"'s legacy saves bucket used to live.
    const sibling = createLabStore({ storageKey: 'a:saves', storage });
    sibling.getState().addWorkspace({
      id: 'sw',
      instrumentName: 'T',
      config: {},
      state: { n: 1 },
      view: VIEW,
    });
    vi.advanceTimersByTime(400);
    const siblingDocument = storage.read(labDocumentKey('a:saves'));
    expect(siblingDocument).not.toBeNull();

    storage.write(labStorageKey('a', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('a', 'theme'), 'dark');

    const lab = createLabStore({ storageKey: 'a', storage });
    // Lab "a" does not read the sibling's document as its own saves bucket.
    expect(lab.getState().savedSnapshots).toEqual([]);
    expect(lab.getState().workspaces).toEqual([]);

    lab.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    // Folding lab "a" deletes its own legacy keys, not the sibling's document.
    expect(storage.read(labStorageKey('a', 'workspaces'))).toBeNull();
    expect(storage.read(labDocumentKey('a:saves'))).toBe(siblingDocument);
    const rehydrated = createLabStore({ storageKey: 'a:saves', storage });
    expect(rehydrated.getState().workspaces).toHaveLength(1);
  });
});

describe('createLabStore — hydrating an incomplete current-version document', () => {
  it('hydrates a document with no saves as an empty snapshot list', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, { workspaces: [], layout: {}, mode: 'dark' });

    const s = makeStore({ storage }).getState();
    expect(s.savedSnapshots).toEqual([]);
    expect(s.listSnapshots()).toEqual([]);
  });

  it('hydrates a document with no layout as an empty layout', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, { workspaces: [], saves: [], mode: 'dark' });

    expect(makeStore({ storage }).getState().layout).toEqual({});
  });

  it('falls back to initialMode when the document has no mode', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, { workspaces: [], saves: [], layout: {} });

    expect(makeStore({ storage, initialMode: 'light' }).getState().mode).toBe('light');
  });

  it('hydrates a document holding nothing but its version', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, {});

    const s = makeStore({ storage }).getState();
    expect(s.workspaces).toEqual([]);
    expect(s.savedSnapshots).toEqual([]);
    expect(s.layout).toEqual({});
    expect(s.mode).toBe('auto');
    expect(s.listSnapshots()).toEqual([]);
  });

  it('can save a snapshot into a document that had no saves', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, {});

    const s = makeStore({ storage });
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().saveSnapshot('w1', 'first');
    expect(s.getState().listSnapshots('w1')).toHaveLength(1);
  });
});

describe('persistence — saves and layout round-trip', () => {
  it('hydrates a populated saves array into the store', () => {
    const storage = createMemoryAdapter();
    writeDocument(storage, { workspaces: [], saves: [SNAPSHOT], layout: {}, mode: 'auto' });

    const s = makeStore({ storage }).getState();
    expect(s.savedSnapshots).toEqual([SNAPSHOT]);
    expect(s.listSnapshots('w1')).toEqual([SNAPSHOT]);
  });

  it('writes the hydrated saves back out on the next flush', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    writeDocument(storage, { workspaces: [], saves: [SNAPSHOT], layout: {}, mode: 'auto' });

    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.saves).toEqual([SNAPSHOT]);
  });

  it('writes a snapshot saved this session out on flush', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const s = makeStore({ storage });
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().saveSnapshot('w1', 'first');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.saves).toHaveLength(1);
    expect(doc.saves[0].name).toBe('first');
  });

  it('writes the layout out on flush', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const s = makeStore({ storage });
    s.getState().setLayout({ w1: { h: 9 } });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.layout).toEqual({ w1: { h: 9 } });
  });
});

describe('createLabStore — quarantining an unusable document', () => {
  it('persists again once the unusable document is safely quarantined', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryAdapter();
    storage.write(labDocumentKey('test'), '{{{not json');

    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(quarantineKey('test'))).toBe('{{{not json');
    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.mode).toBe('light');
    warn.mockRestore();
  });

  it('leaves the original alone when the quarantine copy cannot be written', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryAdapter();
    const write = storage.write.bind(storage);
    // A quota failure as localStorageAdapter reports one: swallowed, void.
    storage.write = (key, value) => {
      if (key === quarantineKey('test')) return;
      write(key, value);
    };
    storage.write(labDocumentKey('test'), '{{{not json');

    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).toBe('{{{not json');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('createLabStore — folding without a mutation', () => {
  it('completes the fold on first load alone', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    makeStore({ storage });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.mode).toBe('dark');
    expect(storage.read(labStorageKey('test', 'workspaces'))).toBeNull();
    expect(storage.read(labStorageKey('test', 'theme'))).toBeNull();
  });

  it('does not schedule a write for a document from the future', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryAdapter();
    const future = JSON.stringify({ version: 999 });
    storage.write(labDocumentKey('test'), future);

    makeStore({ storage });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).toBe(future);
    warn.mockRestore();
  });
});
