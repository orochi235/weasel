import { describe, expect, it } from 'vitest';
import { HistoryRestoreError, type UnresolvedOp } from '@weasel-js/history';
import { createScene } from './scene';
import { RestoredOpError } from './boundOps';
import type { Op } from 'core/ops/types';
import { createOpRegistry, type OpRegistry } from 'core/ops/registry';
import { POSE, type Data, type Layer } from './testing/makeScene';

const LAYERS = [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }] as const;
const sceneWith = (opRegistry?: OpRegistry) =>
  createScene<Data, Layer>({ systemLayers: [...LAYERS], ...(opRegistry ? { opRegistry } : {}) });

interface Cell { value: number; set?(v: number): void }

/** An external op writing `to` through its adapter's `set`, named `name`. */
function cellOp(name: string, from: number, to: number): Op {
  return {
    name, args: { from, to },
    apply: (adapter) => { (adapter as { set(v: number): void }).set(to); },
    invert: () => cellOp(name, to, from),
  };
}

const NAME = 'restoredtest:cell';

/** A registry knowing NAME, a cell its ops write, and the adapter writing it. */
function fixture() {
  const opRegistry = createOpRegistry();
  opRegistry.register(NAME, (args) => {
    const { from, to } = args as { from: number; to: number };
    return cellOp(NAME, from, to);
  });
  const cell: Cell = { value: 0 };
  const adapter = { set: (v: number) => { cell.value = v; } };
  return { opRegistry, cell, adapter };
}

/** A scene holding an entry that set the cell 0 → 7, and its saved history and state. */
function saved(opRegistry: OpRegistry, adapter: unknown) {
  const a = sceneWith(opRegistry);
  a.applyBatch([cellOp(NAME, 0, 7)], 'set cell', adapter);
  return { history: a.serializeHistory(), state: a.toJSON() };
}

function restoreError(run: () => unknown): HistoryRestoreError {
  try { run(); } catch (err) { if (err instanceof HistoryRestoreError) return err; throw err; }
  throw new Error('restore did not throw');
}

describe('restoring external ops', () => {
  it('replays them through the history adapter set before the restore', () => {
    const { opRegistry, cell, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(opRegistry);
    b.loadState(snap.state);
    b.setHistoryAdapter(() => adapter);
    expect(b.restoreHistory(snap.history)).toEqual({ restored: true, unresolved: [] });
    cell.value = 7;
    b.undo();
    expect(cell.value).toBe(0);
    b.redo();
    expect(cell.value).toBe(7);
  });

  it('strict: refuses a history with external ops while no adapter is set, leaving the history as it was', () => {
    const { opRegistry, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(opRegistry);
    b.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'kept' } });
    const err = restoreError(() => b.restoreHistory(snap.history));
    expect(err.report.unresolved).toEqual([
      { entryId: 1, label: 'set cell', name: NAME, args: { from: 0, to: 7 }, reason: 'no-adapter' },
    ]);
    expect(b.historyEntries().map((e) => e.label)).toEqual(['add mark']);
  });

  it('strict: refuses a name the scene’s op registry does not know', () => {
    const { opRegistry, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(); // the default registry has no NAME
    b.setHistoryAdapter(() => adapter);
    expect(restoreError(() => b.restoreHistory(snap.history)).report.unresolved.map((u) => u.reason)).toEqual(['unknown']);
    expect(b.canUndo()).toBe(false);
  });

  it('best-effort: keeps the entry as a placeholder, reports it, and reports each step past it', () => {
    const { opRegistry, cell, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(opRegistry);
    const skips: UnresolvedOp[] = [];
    const report = b.restoreHistory(snap.history, { recovery: 'best-effort', onSkip: (s) => skips.push(s) });
    expect(report.restored).toBe(true);
    expect(report.unresolved.map((u) => [u.name, u.reason])).toEqual([[NAME, 'no-adapter']]);
    cell.value = 7;
    expect(b.undo()).toBe(true);
    expect(cell.value).toBe(7);
    expect(b.canRedo()).toBe(true);
    expect(skips.map((s) => [s.entryId, s.reason])).toEqual([[1, 'no-adapter']]);
  });

  it('strict: an op that throws on undo keeps its entry, and the state, where they were', () => {
    const { opRegistry, adapter } = fixture();
    const a = sceneWith(opRegistry);
    const id = a.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    const move: Op = { apply: (s) => { (s as typeof a).setPose(id, P2); }, invert: () => move };
    // Undo inverts the move first, then the cell op, which throws: the move must come back.
    a.applyBatch([cellOp(NAME, 0, 7), move], 'both', { ...adapter, setPose: a.setPose });
    const b = sceneWith(opRegistry);
    b.loadState(a.toJSON());
    let broken = true;
    b.setHistoryAdapter(() => ({ set: () => { if (broken) throw new Error('cell is read-only'); } }));
    b.restoreHistory(a.serializeHistory());

    let caught: unknown;
    try { b.undo(); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(RestoredOpError);
    expect(caught).toMatchObject({ op: NAME, reason: 'threw', entry: { id: 2, label: 'both' } });
    expect((caught as Error).cause).toEqual(new Error('cell is read-only'));
    expect(b.get(id)?.pose).toEqual(P2);
    expect(b.historyIndex()).toBe(2);

    broken = false;
    expect(b.undo()).toBe(true);
    expect(b.get(id)?.pose).toEqual(POSE);
    expect(b.historyIndex()).toBe(1);
  });

  it('strict: a redo whose adapter was cleared keeps its entry on the redo stack', () => {
    const { opRegistry, cell, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(opRegistry);
    b.setHistoryAdapter(() => adapter);
    b.restoreHistory(snap.history);
    cell.value = 7;
    b.undo();
    b.setHistoryAdapter(null);
    expect(() => b.redo()).toThrow(RestoredOpError);
    expect([b.historyIndex(), b.canRedo(), cell.value]).toEqual([0, true, 0]);
  });

  it('best-effort: a redo whose adapter was cleared skips the op and reports it', () => {
    const { opRegistry, cell, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const b = sceneWith(opRegistry);
    b.setHistoryAdapter(() => adapter);
    const skips: string[] = [];
    b.restoreHistory(snap.history, { recovery: 'best-effort', onSkip: (s) => skips.push(s.reason) });
    cell.value = 7;
    b.undo();
    b.setHistoryAdapter(null);
    expect(b.redo()).toBe(true);
    expect([cell.value, skips]).toEqual([0, ['no-adapter']]);
  });

  it('a snapshot in another recorded form: strict throws, best-effort reports it dropped', () => {
    const b = sceneWith();
    const stale = { version: 1, form: 3, undoStack: [], redoStack: [], nextEntryId: 1, droppedEntries: 0 } as never;
    expect(() => b.restoreHistory(stale)).toThrow(/recorded form/);
    expect(b.restoreHistory(stale, { recovery: 'best-effort' })).toEqual({ restored: false, unresolved: [] });
  });
});

describe('op registry context', () => {
  it('isolated scenes rebuild one op name each through their own factory', () => {
    const writes: string[] = [];
    const registryFor = (tag: string) => {
      const r = createOpRegistry();
      r.register(NAME, (args) => ({
        name: NAME, args,
        apply: () => { writes.push(tag); },
        invert: () => ({ name: NAME, args, apply: () => { writes.push(`${tag}:undo`); }, invert: () => { throw new Error('unused'); } }),
      }));
      return r;
    };
    const source = sceneWith(registryFor('source'));
    source.applyBatch([cellOp(NAME, 0, 1)], 'set', { set: () => {} });
    const history = source.serializeHistory();
    const one = sceneWith(registryFor('one'));
    const two = sceneWith(registryFor('two'));
    for (const s of [one, two]) {
      s.setHistoryAdapter(() => null);
      s.restoreHistory(history);
      s.undo();
    }
    expect(writes).toEqual(['one:undo', 'two:undo']);
  });

  it('scenes holding one registry share what it holds', () => {
    const { opRegistry, cell, adapter } = fixture();
    const snap = saved(opRegistry, adapter);
    const shared = createOpRegistry({ parent: opRegistry });
    const b = sceneWith(shared);
    expect(b.opRegistry).toBe(shared);
    b.setHistoryAdapter(() => adapter);
    b.restoreHistory(snap.history);
    cell.value = 7;
    b.undo();
    expect(cell.value).toBe(0);
  });
});
