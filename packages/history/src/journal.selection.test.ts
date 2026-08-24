import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function makeSelection(initial: string[] = []) {
  let ids: readonly string[] = initial;
  return { get: () => ids, set: (n: readonly string[]) => { ids = n; }, read: () => [...ids] };
}

function addOp(store: string[], id: string): Op {
  return {
    name: 'add',
    args: { id },
    apply: () => { store.push(id); },
    invert: () => ({
      name: 'remove',
      args: { id },
      apply: () => { store.splice(store.indexOf(id), 1); },
      invert: () => addOp(store, id),
    }),
  };
}

describe('journal — selection snapshots', () => {
  it('undoing the committed entry restores the selection the journal opened under', () => {
    const store: string[] = [];
    const selection = makeSelection(['editing-me']);
    const history = createHistory(undefined, { selection });

    const journal = history.beginJournal({ label: 'text edit' });
    selection.set(['mid-session']);
    journal.applyBatch([addOp(store, 'c')], 'keystroke');
    selection.set(['after']);
    journal.commit('text edit');

    history.undo();
    expect(selection.read()).toEqual(['editing-me']);
  });

  it('undo inside the session restores selection too', () => {
    const store: string[] = [];
    const selection = makeSelection(['a']);
    const history = createHistory(undefined, { selection });

    const journal = history.beginJournal({ label: 'session' });
    journal.applyBatch([addOp(store, 'c')], 'keystroke');
    selection.set(['moved-on']);
    journal.undo();

    expect(selection.read()).toEqual(['a']);
  });
});
