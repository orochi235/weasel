import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function makeSelection(initial: string[] = []) {
  let ids: readonly string[] = initial;
  return {
    get: () => ids,
    set: (next: readonly string[]) => { ids = next; },
    read: () => [...ids],
  };
}

/** Op over a plain array of ids, so entries have real forward/invert work. */
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

describe('history — selection snapshots', () => {
  it('undo restores the selection as of just before the entry', () => {
    const store: string[] = [];
    const selection = makeSelection(['a', 'b']);
    const history = createHistory(undefined, { selection });

    history.applyOps([addOp(store, 'c')], 'add c');
    selection.set(['c']);

    history.undo();
    expect(selection.read()).toEqual(['a', 'b']);
  });

  it('redo restores the selection the user had before undoing', () => {
    const store: string[] = [];
    const selection = makeSelection(['a', 'b']);
    const history = createHistory(undefined, { selection });

    history.applyOps([addOp(store, 'c')], 'add c');
    selection.set(['c']);
    history.undo();
    history.redo();

    expect(selection.read()).toEqual(['c']);
  });

  it('restores selection after the entry ops apply, not before', () => {
    const store: string[] = [];
    const selection = makeSelection(['a']);
    const order: string[] = [];
    const history = createHistory(undefined, { selection });
    const op: Op = {
      name: 'noteOrder',
      args: {},
      apply: () => { order.push('forward'); },
      invert: () => ({
        name: 'noteOrder',
        args: {},
        apply: () => { order.push('invert'); },
        invert: () => op,
      }),
    };

    history.applyOps([op], 'note');
    selection.set(['z']);
    const spy = { ...selection, set: (ids: readonly string[]) => { order.push('selection'); selection.set(ids); } };
    const h2 = createHistory(undefined, { selection: spy });
    h2.applyOps([op], 'note');
    h2.undo();

    expect(order.slice(-2)).toEqual(['invert', 'selection']);
    expect(store).toEqual([]);
  });

  it('a bare selection change creates no entry', () => {
    const selection = makeSelection(['a']);
    const history = createHistory(undefined, { selection });

    selection.set(['b']);
    selection.set(['c']);

    expect(history.undoDepth()).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it('a coalesced entry keeps the selection from its first push', () => {
    const store: string[] = [];
    const selection = makeSelection(['a']);
    let clock = 0;
    const history = createHistory(undefined, {
      selection,
      coalesceWindowMs: 1000,
      now: () => clock,
    });

    const drag = (id: string): Op => ({ ...addOp(store, id), coalesceKey: 'drag:x' });
    history.applyOps([drag('c')], 'drag');
    selection.set(['mid-drag']);
    clock += 10;
    history.applyOps([drag('d')], 'drag');

    expect(history.undoDepth()).toBe(1);
    history.undo();
    expect(selection.read()).toEqual(['a']);
  });

  it('recordEntry takes the selection the caller captured when the batch opened', () => {
    const store: string[] = [];
    const selection = makeSelection(['start']);
    const history = createHistory(undefined, { selection });

    const before = selection.read();
    // Simulates scene.batch: ops already applied, selection already moved on.
    store.push('c');
    selection.set(['end']);
    history.recordEntry([addOp(store, 'c')], 'batched', { selectionBefore: before });

    history.undo();
    expect(selection.read()).toEqual(['start']);
  });

  it('leaves selection alone for an entry that carries no snapshot', () => {
    const store: string[] = [];
    const selection = makeSelection(['a']);
    const history = createHistory(undefined, { selection });

    store.push('c');
    history.recordEntry([addOp(store, 'c')], 'no snapshot');
    selection.set(['untouched']);
    history.undo();

    expect(selection.read()).toEqual(['untouched']);
  });

  it('works with no selection option wired', () => {
    const store: string[] = [];
    const history = createHistory(undefined);

    history.applyOps([addOp(store, 'c')], 'add c');
    expect(() => history.undo()).not.toThrow();
    expect(store).toEqual([]);
  });

  it('round-trips snapshots through serialize / restore', () => {
    const store: string[] = [];
    const selection = makeSelection(['a', 'b']);
    const history = createHistory(undefined, { selection });
    history.applyOps([addOp(store, 'c')], 'add c');
    selection.set(['c']);

    const snapshot = history.serialize();

    const store2 = ['c'];
    const selection2 = makeSelection(['c']);
    const restored = createHistory(undefined, {
      selection: selection2,
      rebuildOp: (name, args) => {
        const id = (args as { id: string }).id;
        return name === 'add' ? addOp(store2, id) : null;
      },
    });
    restored.restore(snapshot);
    restored.undo();

    expect(selection2.read()).toEqual(['a', 'b']);
  });

  it('exposes the snapshots on entries()', () => {
    const store: string[] = [];
    const selection = makeSelection(['a']);
    const history = createHistory(undefined, { selection });
    history.applyOps([addOp(store, 'c')], 'add c');

    expect(history.entries().undo[0].selectionBefore).toEqual(['a']);
  });
});
