import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { CURRENT_DOCUMENT_VERSION, labDocumentKey, quarantineKey } from './document';
import { labStorageKey } from './helpers';
import { labPrefix, recordsOfDocument } from './labRecords';
import { type OpenLabStoreOptions, openLabStore } from './openLabStore';
import type { LabDocument, StorageAdapter, TrialRecord } from './types';

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };
const P = labPrefix('test');

function trial(id: string, extra: Record<string, unknown> = {}) {
  return { id, instrumentName: 'T', config: {}, state: {}, view: VIEW, ...extra };
}

function open(backing: Map<string, unknown>, overrides: Partial<OpenLabStoreOptions> = {}) {
  return openLabStore({ storageKey: 'test', storage: createMemoryAdapter(backing), ...overrides });
}

/** Lab records as a current labkit writes them. */
function storeLab(backing: Map<string, unknown>, doc: Partial<LabDocument>, storageKey = 'test') {
  const full: LabDocument = {
    version: CURRENT_DOCUMENT_VERSION,
    trials: [],
    saves: [],
    layout: {},
    undockedPanels: {},
    mode: 'auto',
    ...doc,
  };
  for (const [name, value] of recordsOfDocument(full)) {
    backing.set(labPrefix(storageKey) + name, structuredClone(value));
  }
}

/** A version-3 document, as the single-document labkit stored one. */
function storeV3(backing: Map<string, unknown>, doc: Record<string, unknown>) {
  backing.set(labDocumentKey('test'), JSON.stringify({ version: 3, ...doc }));
}

/** Let the memory adapter's queued notifications reach the other tab. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const SNAPSHOT = {
  id: 's1',
  name: 'saved',
  trialId: 'w1',
  instrumentName: 'T',
  config: { x: 1 },
  state: { n: 5 },
  savedAt: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openLabStore — round trips', () => {
  it('reopens a trial it stored, with an empty undo history', async () => {
    const backing = new Map<string, unknown>();
    const first = await open(backing);
    first.store.getState().addTrial(trial('w1', { state: { n: 7 } }));
    first.store.getState().updateTrialUndoStack('w1', { past: [{ n: 6 }], future: [] });
    await first.close();

    const again = await open(backing);
    expect(again.store.getState().trials).toHaveLength(1);
    expect(again.store.getState().trials[0]).toMatchObject({ id: 'w1', state: { n: 7 } });
    expect(again.store.getState().trials[0]?.undoStack).toEqual({ past: [], future: [] });
  });

  // An instrument holding a Map, a Set or anything else storage cannot keep
  // needs these at both ends.
  it("runs an instrument's serializers when writing and when reading", async () => {
    const backing = new Map<string, unknown>();
    const serializers = {
      T: {
        serialize: (state: unknown) => [...(state as Map<string, number>)],
        deserialize: (data: unknown) => new Map(data as [string, number][]),
      },
    };
    const first = await open(backing, { serializers });
    first.store.getState().addTrial(trial('w1', { state: new Map([['a', 1]]) }));
    await first.close();
    expect((backing.get(`${P}trial:w1`) as { state: unknown }).state).toEqual([['a', 1]]);

    const again = await open(backing, { serializers });
    expect(again.store.getState().trials[0]?.state).toEqual(new Map([['a', 1]]));
  });

  it('hands `deserialize` the config the state was saved against', async () => {
    const backing = new Map<string, unknown>();
    const first = await open(backing);
    first.store.getState().addTrial(trial('w1', { config: { scale: 4 }, state: { n: 1 } }));
    await first.close();

    const deserialize = vi.fn((data: unknown) => data);
    await open(backing, { serializers: { T: { deserialize } } });
    expect(deserialize).toHaveBeenCalledWith({ n: 1 }, { scale: 4 });
  });

  it('keeps a title and folded sections', async () => {
    const backing = new Map<string, unknown>();
    const first = await open(backing);
    first.store.getState().addTrial(trial('w1'));
    first.store.getState().setTrialTitle('w1', 'Sprocket 7');
    first.store.getState().setTrialSectionCollapsed('w1', 'settings/Shape', true);
    await first.close();

    const t = (await open(backing)).store.getState().trials[0];
    expect(t?.title).toBe('Sprocket 7');
    expect(t?.collapsedSections).toEqual({ 'settings/Shape': true });
  });

  it('keeps saves, layout, undocked panels and mode', async () => {
    const backing = new Map<string, unknown>();
    const first = await open(backing);
    first.store.getState().addTrial(trial('w1'));
    first.store.getState().saveSnapshot('w1', 'first');
    first.store.getState().setLayout({ w1: { h: 9 } });
    first.store.getState().undockPanel('w1', 'settings', 'floating');
    first.store.getState().setMode('light');
    await first.close();

    const s = (await open(backing)).store.getState();
    expect(s.savedSnapshots.map((sn) => sn.name)).toEqual(['first']);
    expect(s.layout).toEqual({ w1: { h: 9 } });
    expect(Object.values(s.undockedPanels)).toEqual([
      { trialId: 'w1', sectionId: 'settings', as: 'floating' },
    ]);
    expect(s.mode).toBe('light');
  });

  it('persists a bare store.setState too', async () => {
    const backing = new Map<string, unknown>();
    const first = await open(backing);
    first.store.setState({ layout: { direct: true } });
    await first.close();
    expect((await open(backing)).store.getState().layout).toEqual({ direct: true });
  });
});

describe('openLabStore — config defaults', () => {
  const stored = (config: unknown) => ({
    trials: [trial('w1', { config })],
    saves: [{ ...SNAPSHOT, config }],
  });

  it('fills a branch a config stored before the schema nested it never had', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, stored({ showGrid: false, gridSize: 40 }));
    const { store } = await open(backing, {
      configDefaults: { T: () => ({ showGrid: true, grid: { size: 20, color: '#fff' } }) },
    });
    expect(store.getState().trials[0]?.config).toEqual({
      showGrid: false,
      gridSize: 40,
      grid: { size: 20, color: '#fff' },
    });
  });

  it('fills the config on a saved snapshot the same way', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, stored({ grid: { size: 40 } }));
    const { store } = await open(backing, {
      configDefaults: { T: () => ({ grid: { size: 20, color: '#fff' } }) },
    });
    expect(store.getState().savedSnapshots[0]?.config).toEqual({
      grid: { size: 40, color: '#fff' },
    });
  });

  it('hands a deserializer the filled config, not the stored one', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, stored({ grid: { size: 40 } }));
    const seen: unknown[] = [];
    await open(backing, {
      configDefaults: { T: () => ({ grid: { size: 20, color: '#fff' } }) },
      serializers: {
        T: {
          deserialize: (state, config) => {
            seen.push(config);
            return state;
          },
        },
      },
    });
    expect(seen).toEqual([{ grid: { size: 40, color: '#fff' } }]);
  });

  it('leaves a config alone when no defaults are registered for its instrument', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, stored({ only: 1 }));
    expect((await open(backing)).store.getState().trials[0]?.config).toEqual({ only: 1 });
  });
});

describe('openLabStore — what a change writes', () => {
  function counting(backing: Map<string, unknown>) {
    const storage = createMemoryAdapter(backing);
    const set = vi.spyOn(storage, 'set');
    const del = vi.spyOn(storage, 'delete');
    return { storage, set, del };
  }

  it('writes only the trial that changed', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('a'), trial('b')] });
    const { storage, set } = counting(backing);
    const opened = await openLabStore({ storageKey: 'test', storage });
    opened.store.getState().updateTrialState('b', { n: 1 });
    await opened.close();
    expect(set.mock.calls.map(([key]) => key)).toEqual([`${P}trial:b`]);
  });

  it('writes nothing for a change to undo history alone', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('a')] });
    const { storage, set } = counting(backing);
    const opened = await openLabStore({ storageKey: 'test', storage });
    opened.store.getState().updateTrialUndoStack('a', { past: [{}], future: [] });
    await opened.close();
    expect(set).not.toHaveBeenCalled();
  });

  it("deletes a removed trial's record and every value scoped to it", async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('a'), trial('b')] });
    backing.set(`${P}value:trial:a:tab`, 'shape');
    backing.set(`${P}value:trial:b:tab`, 'color');
    const opened = await open(backing);
    opened.store.getState().removeTrial('a');
    await opened.close();
    expect(backing.has(`${P}trial:a`)).toBe(false);
    expect(backing.has(`${P}value:trial:a:tab`)).toBe(false);
    expect(backing.get(`${P}value:trial:b:tab`)).toBe('color');
  });

  it('writes and deletes one record per snapshot', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('w1')], saves: [SNAPSHOT] });
    const opened = await open(backing);
    opened.store.getState().deleteSnapshot('s1');
    await opened.close();
    expect(backing.has(`${P}save:s1`)).toBe(false);
  });

  it('writes a meta record with the first change to a new lab', async () => {
    const backing = new Map<string, unknown>();
    const opened = await open(backing);
    opened.store.getState().setLayout({ a: 1 });
    await opened.close();
    expect(backing.get(`${P}meta`)).toEqual({ version: CURRENT_DOCUMENT_VERSION, mode: 'auto' });
  });

  it('writes nothing for a lab opened and closed untouched', async () => {
    const backing = new Map<string, unknown>();
    await (await open(backing)).close();
    expect(backing.size).toBe(0);
  });
});

describe('openLabStore — trial order', () => {
  it('keeps a reorder across a reload', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('a'), trial('b'), trial('c')] });
    const opened = await open(backing);
    const [a, b, c] = opened.store.getState().trials as [TrialRecord, TrialRecord, TrialRecord];
    opened.store.setState({ trials: [c, a, b] });
    await opened.close();
    const ids = (await open(backing)).store.getState().trials.map((t) => t.id);
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('keeps a trial inserted mid-list where it was put', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('a'), trial('c')] });
    const opened = await open(backing);
    const [a, c] = opened.store.getState().trials as [TrialRecord, TrialRecord];
    const b: TrialRecord = { ...trial('b'), undoStack: { past: [], future: [] } };
    opened.store.setState({ trials: [a, b, c] });
    await opened.close();
    const ids = (await open(backing)).store.getState().trials.map((t) => t.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('openLabStore — two tabs', () => {
  it('keeps a trial each tab added at the same time, in the same order everywhere', async () => {
    const backing = new Map<string, unknown>();
    const tabA = await open(backing);
    const tabB = await open(backing);
    tabB.store.getState().addTrial(trial('b1'));
    tabA.store.getState().addTrial(trial('a1'));
    await Promise.all([tabA.records.flush(), tabB.records.flush()]);
    await tick();

    const order = (s: typeof tabA) => s.store.getState().trials.map((t) => t.id);
    expect(order(tabA)).toEqual(['a1', 'b1']);
    expect(order(tabB)).toEqual(['a1', 'b1']);
    expect(order(await open(backing))).toEqual(['a1', 'b1']);
  });

  it("applies another tab's edit to a trial, and clears only that trial's undo history", async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('t1', { state: { n: 0 } }), trial('t2')] });
    const tabA = await open(backing);
    const tabB = await open(backing);
    tabA.store.getState().updateTrialUndoStack('t1', { past: [{ n: -1 }], future: [] });
    tabA.store.getState().updateTrialUndoStack('t2', { past: [{ n: -2 }], future: [] });

    tabB.store.getState().updateTrialState('t1', { n: 5 });
    await tabB.records.flush();
    await tick();

    const [t1, t2] = tabA.store.getState().trials;
    expect(t1?.state).toEqual({ n: 5 });
    expect(t1?.undoStack).toEqual({ past: [], future: [] });
    expect(t2?.undoStack).toEqual({ past: [{ n: -2 }], future: [] });
  });

  it("applies another tab's delete, snapshot, layout and mode without writing them back", async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('t1'), trial('t2')] });
    const storageA = createMemoryAdapter(backing);
    const setA = vi.spyOn(storageA, 'set');
    const tabA = await openLabStore({ storageKey: 'test', storage: storageA });
    const tabB = await open(backing);

    tabB.store.getState().removeTrial('t2');
    tabB.store.getState().saveSnapshot('t1', 'from b');
    tabB.store.getState().setLayout({ t1: { h: 2 } });
    tabB.store.getState().setMode('dark');
    await tabB.records.flush();
    await tick();

    const s = tabA.store.getState();
    expect(s.trials.map((t) => t.id)).toEqual(['t1']);
    expect(s.savedSnapshots.map((sn) => sn.name)).toEqual(['from b']);
    expect(s.layout).toEqual({ t1: { h: 2 } });
    expect(s.mode).toBe('dark');
    await tabA.records.flush();
    expect(setA).not.toHaveBeenCalled();
  });

  it('stops writing once another tab stores the lab with a newer labkit', async () => {
    const backing = new Map<string, unknown>();
    const tabA = await open(backing);
    const newer = createMemoryAdapter(backing);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await newer.set(`${P}meta`, { version: CURRENT_DOCUMENT_VERSION + 1, mode: 'auto' });
    await tick();
    tabA.store.getState().setLayout({ mine: true });
    await tabA.close();
    expect(backing.has(`${P}layout`)).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe('openLabStore — records it cannot use', () => {
  it('opens records from a newer labkit empty, and never writes over them', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('w1')] });
    backing.set(`${P}meta`, { version: 999, mode: 'auto' });
    const before = new Map(backing);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const opened = await open(backing);
    expect(opened.store.getState().trials).toEqual([]);
    opened.store.getState().setMode('light');
    await opened.close();
    expect(backing).toEqual(before);
  });

  it('ignores a record whose name no lab writes', async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('w1')] });
    backing.set(`${P}trial:w1:extra`, { id: 'nope' });
    backing.set(`${P}bogus`, 1);
    expect((await open(backing)).store.getState().trials.map((t) => t.id)).toEqual(['w1']);
  });

  it("never reads another lab's records, even one whose name extends its own", async () => {
    const backing = new Map<string, unknown>();
    storeLab(backing, { trials: [trial('sibling')] }, 'a:trial:x');
    storeLab(backing, { trials: [trial('mine')] }, 'a');
    const opened = await openLabStore({ storageKey: 'a', storage: createMemoryAdapter(backing) });
    expect(opened.store.getState().trials.map((t) => t.id)).toEqual(['mine']);
  });
});

describe('openLabStore — folding a version-3 document', () => {
  it('opens it, writes it as records, and deletes it only after they read back', async () => {
    const backing = new Map<string, unknown>();
    storeV3(backing, {
      trials: [trial('w1', { view: { zoom: 2, pan: { x: 0, y: 0 } } })],
      saves: [SNAPSHOT],
      layout: { w1: { h: 3 } },
      undockedPanels: {},
      mode: 'dark',
    });
    const opened = await open(backing);
    const s = opened.store.getState();
    expect(s.trials.map((t) => t.id)).toEqual(['w1']);
    expect(s.savedSnapshots).toHaveLength(1);
    expect(s.layout).toEqual({ w1: { h: 3 } });
    expect(s.mode).toBe('dark');
    expect(backing.has(labDocumentKey('test'))).toBe(false);
    expect(backing.get(`${P}meta`)).toEqual({ version: CURRENT_DOCUMENT_VERSION, mode: 'dark' });
    expect(backing.has(`${P}trial:w1`)).toBe(true);
  });

  it('opens a version-1 document, whose tiles were still called workspaces', async () => {
    const backing = new Map<string, unknown>();
    backing.set(
      labDocumentKey('test'),
      JSON.stringify({
        version: 1,
        workspaces: [trial('w1', { config: { gain: 3 }, state: { n: 7 } })],
        saves: [{ id: 's1', name: 'a save', trialId: 'w1' }],
        layout: { w1: { h: 3 } },
        mode: 'dark',
      }),
    );
    const s = (await open(backing)).store.getState();
    expect(s.trials[0]).toMatchObject({ id: 'w1', config: { gain: 3 }, state: { n: 7 } });
    expect(s.savedSnapshots).toHaveLength(1);
  });

  it('keeps the old document when the records do not read back', async () => {
    const backing = new Map<string, unknown>();
    storeV3(backing, { trials: [trial('w1')], saves: [], layout: {}, mode: 'auto' });
    const memory = createMemoryAdapter(backing);
    const dropsMeta: StorageAdapter = {
      ...memory,
      set: async (key, value) => {
        if (key === `${P}meta`) return;
        await memory.set(key, value);
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const opened = await openLabStore({ storageKey: 'test', storage: dropsMeta });
    expect(opened.store.getState().trials.map((t) => t.id)).toEqual(['w1']);
    expect(backing.has(labDocumentKey('test'))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeping the old storage'));
  });

  it('fills whatever an incomplete document is missing', async () => {
    const backing = new Map<string, unknown>();
    storeV3(backing, {});
    const s = (await open(backing, { initialMode: 'light' })).store.getState();
    expect(s.trials).toEqual([]);
    expect(s.savedSnapshots).toEqual([]);
    expect(s.layout).toEqual({});
    expect(s.mode).toBe('light');
  });

  it('opens a trial stored before titles and folds existed', async () => {
    const backing = new Map<string, unknown>();
    storeV3(backing, { trials: [trial('w1')], saves: [], layout: {}, mode: 'auto' });
    const t = (await open(backing)).store.getState().trials[0];
    expect(t?.title).toBeUndefined();
    expect(t?.collapsedSections).toBeUndefined();
  });

  it('opens a document from a newer labkit empty, and leaves it alone', async () => {
    const backing = new Map<string, unknown>();
    const future = JSON.stringify({ version: 999, trials: [trial('w1')] });
    backing.set(labDocumentKey('test'), future);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const opened = await open(backing);
    expect(opened.store.getState().trials).toEqual([]);
    opened.store.getState().setMode('light');
    await opened.close();
    expect([...backing]).toEqual([[labDocumentKey('test'), future]]);
  });

  it('quarantines an unparseable document, deletes it, and persists again', async () => {
    const backing = new Map<string, unknown>();
    backing.set(labDocumentKey('test'), '{{{not json');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const opened = await open(backing);
    expect(opened.store.getState().trials).toEqual([]);
    opened.store.getState().setMode('light');
    await opened.close();
    expect(backing.get(quarantineKey('test'))).toBe('{{{not json');
    expect(backing.has(labDocumentKey('test'))).toBe(false);
    expect(backing.get(`${P}meta`)).toEqual({ version: CURRENT_DOCUMENT_VERSION, mode: 'light' });
  });

  it('leaves the original alone and stops persisting when the quarantine copy will not land', async () => {
    const backing = new Map<string, unknown>();
    backing.set(labDocumentKey('test'), '{{{not json');
    const memory = createMemoryAdapter(backing);
    const dropsQuarantine: StorageAdapter = {
      ...memory,
      set: async (key, value) => {
        if (key === quarantineKey('test')) return;
        await memory.set(key, value);
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const opened = await openLabStore({ storageKey: 'test', storage: dropsQuarantine });
    opened.store.getState().setMode('light');
    await opened.close();
    expect([...backing]).toEqual([[labDocumentKey('test'), '{{{not json']]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not be quarantined'),
      undefined,
    );
  });
});

describe('openLabStore — folding the four pre-document keys', () => {
  it('folds them, turning the old interstellar theme into dark, and deletes them', async () => {
    const backing = new Map<string, unknown>();
    backing.set(labStorageKey('test', 'workspaces'), JSON.stringify([trial('w1')]));
    backing.set(labStorageKey('test', 'theme'), 'interstellar');
    const s = (await open(backing)).store.getState();
    expect(s.mode).toBe('dark');
    expect(s.trials.map((t) => t.id)).toEqual(['w1']);
    expect(backing.has(labStorageKey('test', 'workspaces'))).toBe(false);
    expect(backing.has(labStorageKey('test', 'theme'))).toBe(false);
  });

  it('honors initialMode when the old lab never set a theme', async () => {
    const backing = new Map<string, unknown>();
    backing.set(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    expect((await open(backing, { initialMode: 'dark' })).store.getState().mode).toBe('dark');
  });

  it("folds lab a without touching lab a:saves, whose old document sat where a's saves bucket did", async () => {
    const backing = new Map<string, unknown>();
    const sibling = await openLabStore({
      storageKey: 'a:saves',
      storage: createMemoryAdapter(backing),
    });
    sibling.store.getState().addTrial(trial('sw'));
    await sibling.close();
    backing.set(labStorageKey('a', 'workspaces'), JSON.stringify([]));
    backing.set(labStorageKey('a', 'theme'), 'dark');

    const lab = await openLabStore({ storageKey: 'a', storage: createMemoryAdapter(backing) });
    expect(lab.store.getState().savedSnapshots).toEqual([]);
    expect(lab.store.getState().trials).toEqual([]);
    await lab.close();

    expect(backing.has(labStorageKey('a', 'workspaces'))).toBe(false);
    const again = await openLabStore({
      storageKey: 'a:saves',
      storage: createMemoryAdapter(backing),
    });
    expect(again.store.getState().trials.map((t) => t.id)).toEqual(['sw']);
  });
});
