import { describe, expect, it } from 'vitest';
import { createLabStore } from './store';
import type { CreateLabStoreOptions } from './types';

function makeStore(overrides?: CreateLabStoreOptions) {
  return createLabStore({ ...overrides });
}

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

describe('createLabStore — initial state', () => {
  it('starts with empty trials and saves', () => {
    const s = makeStore();
    expect(s.getState().trials).toEqual([]);
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

describe('addTrial', () => {
  it('adds a trial with an empty undoStack', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'Test',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    expect(s.getState().trials).toHaveLength(1);
    expect(s.getState().trials[0]?.undoStack).toEqual({ past: [], future: [] });
  });
});

describe('removeTrial', () => {
  it('removes by id', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().removeTrial('w1');
    expect(s.getState().trials).toHaveLength(0);
  });
});

describe('updateTrialState', () => {
  it('updates state with a plain value', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 0 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateTrialState('w1', { n: 42 });
    expect(s.getState().trials[0]?.state).toEqual({ n: 42 });
  });

  it('updates state with an updater function', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 1 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateTrialState('w1', (prev: unknown) => ({
      n: (prev as { n: number }).n + 1,
    }));
    expect((s.getState().trials[0]?.state as { n: number }).n).toBe(2);
  });
});

describe('updateTrialConfig', () => {
  it('updates a single config key', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: { x: 1, y: 2 },
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateTrialConfig('w1', 'x', 99);
    expect((s.getState().trials[0]?.config as { x: number }).x).toBe(99);
    expect((s.getState().trials[0]?.config as { y: number }).y).toBe(2);
  });

  it('writes down a dotted path without disturbing its siblings', () => {
    const s = makeStore();
    const config = { grid: { size: 20, color: '#fff' }, showGrid: true };
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config,
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().updateTrialConfig('w1', 'grid.size', 40);
    expect(s.getState().trials[0]?.config).toEqual({
      grid: { size: 40, color: '#fff' },
      showGrid: true,
    });
    // The record handed in is never mutated: a trial re-renders on identity.
    expect(config.grid.size).toBe(20);
  });
});

describe('setMode', () => {
  it('updates mode', () => {
    const s = makeStore();
    s.getState().setMode('dark');
    expect(s.getState().mode).toBe('dark');
  });
});

describe('save/load/delete snapshots', () => {
  it('saveSnapshot creates a snapshot', () => {
    const s = makeStore();
    s.getState().addTrial({
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
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: { x: 1 },
      state: { n: 5 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'snap1');
    s.getState().updateTrialState('w1', { n: 99 });
    const snapId = s.getState().savedSnapshots[0]?.id ?? '';
    s.getState().loadSnapshot(snapId, 'w1');
    expect((s.getState().trials[0]?.state as { n: number }).n).toBe(5);
  });

  it('loadSnapshot blocks cross-instrument load', () => {
    const s = makeStore();
    s.getState().addTrial({
      id: 'w1',
      instrumentName: 'A',
      config: {},
      state: { n: 1 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    s.getState().saveSnapshot('w1', 'snap-a');
    s.getState().setTrialInstrument('w1', 'B');
    const snapId = s.getState().savedSnapshots[0]?.id ?? '';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.getState().loadSnapshot(snapId, 'w1');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('deleteSnapshot removes the snapshot', () => {
    const s = makeStore();
    s.getState().addTrial({
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
    s.getState().addTrial({
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

describe('undocking a sidebar panel', () => {
  it('starts with nothing undocked', () => {
    expect(makeStore().getState().undockedPanels).toEqual({});
  });

  it('records an undock and docks it back', () => {
    const s = makeStore();
    s.getState().undockPanel('t1', 'settings', 'floating');
    expect(Object.values(s.getState().undockedPanels)).toEqual([
      { trialId: 't1', sectionId: 'settings', as: 'floating' },
    ]);
    s.getState().dockPanel('t1', 'settings');
    expect(s.getState().undockedPanels).toEqual({});
  });

  it('closing a trial takes its undocked panels with it', () => {
    const s = makeStore();
    s.getState().addTrial({ id: 't1', instrumentName: 'i', config: {}, state: {}, view: null });
    s.getState().undockPanel('t1', 'settings');
    s.getState().removeTrial('t1');
    expect(s.getState().undockedPanels).toEqual({});
  });
});

describe('setTrialTitle', () => {
  it('holds a title and returns to the instrument name on null', () => {
    const s = makeStore();
    s.getState().addTrial({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().setTrialTitle('w1', 'Sprocket 7');
    expect(s.getState().trials[0]?.title).toBe('Sprocket 7');
    s.getState().setTrialTitle('w1', null);
    expect(s.getState().trials[0]?.title).toBeUndefined();
  });

  it('leaves the record alone when the title is unchanged', () => {
    const s = makeStore();
    s.getState().addTrial({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().setTrialTitle('w1', 'Sprocket 7');
    const before = s.getState().trials[0];
    s.getState().setTrialTitle('w1', 'Sprocket 7');
    expect(s.getState().trials[0]).toBe(before);
  });
});

describe('setTrialSectionCollapsed', () => {
  it('folds one section without touching the others', () => {
    const s = makeStore();
    s.getState().addTrial({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().setTrialSectionCollapsed('w1', 'settings', true);
    s.getState().setTrialSectionCollapsed('w1', 'marks', false);
    expect(s.getState().trials[0]?.collapsedSections).toEqual({ settings: true, marks: false });
  });

  it('leaves the record alone when the fold is unchanged', () => {
    const s = makeStore();
    s.getState().addTrial({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: VIEW });
    s.getState().setTrialSectionCollapsed('w1', 'settings', true);
    const before = s.getState().trials[0];
    s.getState().setTrialSectionCollapsed('w1', 'settings', true);
    expect(s.getState().trials[0]).toBe(before);
  });
});
