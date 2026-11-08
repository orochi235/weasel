import { createClockRegistry } from '@weasel-js/clock';
import { describe, expect, it } from 'vitest';
import { createLabStore } from '../state/store';
import { snapshotCommands } from './snapshotCommands';

describe('snapshotCommands', () => {
  it('names a save after the last name taken, not after how many are left', () => {
    const store = createLabStore({});
    store.getState().addTrial({
      id: 't1',
      instrumentName: 'x',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    const commands = snapshotCommands(store, createClockRegistry(null), [], new Map());
    commands.saveSnapshot('t1');
    commands.saveSnapshot('t1');
    const first = store.getState().savedSnapshots[0];
    if (!first) throw new Error('no snapshot');
    store.getState().deleteSnapshot(first.id);
    commands.saveSnapshot('t1');
    expect(store.getState().savedSnapshots.map((s) => s.name)).toEqual([
      'Snapshot 2',
      'Snapshot 3',
    ]);
  });
});
