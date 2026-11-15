import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Cell { x: number }

function setX(cell: Cell, from: number, to: number): Op {
  return {
    name: 'rebuildtest:setX',
    args: { id: 'a', from, to },
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from),
  };
}

describe('CreateHistoryOptions.rebuildOp', () => {
  it('rebuilds each serialized op through the hook, which receives (name, args)', () => {
    const src: Cell = { x: 0 };
    const a = createHistory(null);
    a.applyOps([setX(src, 0, 5)], 'set');
    const snap = a.serialize();

    const dst: Cell = { x: 5 };
    const seen: [string, unknown][] = [];
    const b = createHistory(null, {
      rebuildOp: (name, args) => {
        seen.push([name, args]);
        const { from, to } = args as { from: number; to: number };
        return setX(dst, from, to);
      },
    });
    b.restore(snap);
    // Once: an entry nothing coalesced into shares one list as both halves.
    expect(seen).toEqual([['rebuildtest:setX', { id: 'a', from: 0, to: 5 }]]);
    b.undo();
    expect(dst.x).toBe(0);
    b.redo();
    expect(dst.x).toBe(5);
  });

  it('tells the hook which entry the op belongs to and the restore\'s recovery', () => {
    const a = createHistory(null);
    a.applyOps([setX({ x: 0 }, 0, 5)], 'set');
    const seen: unknown[] = [];
    const b = createHistory(null, {
      rebuildOp: (_name, args, ctx) => {
        seen.push([ctx.entry, ctx.recovery]);
        const { from, to } = args as { from: number; to: number };
        return setX({ x: 5 }, from, to);
      },
    });
    b.restore(a.serialize());
    expect(seen).toEqual([[{ id: 1, label: 'set' }, 'strict']]);
  });

  it('reports an op the hook answers as unresolvable, with its reason', () => {
    const a = createHistory(null);
    a.applyOps([setX({ x: 0 }, 0, 5)], 'set');
    const b = createHistory(null, { rebuildOp: () => ({ unresolved: 'no-adapter' }) });
    expect(() => b.restore(a.serialize())).toThrow(/"rebuildtest:setX" \(no-adapter\) in entry 1 "set"/);
    expect(b.restore(a.serialize(), { recovery: 'best-effort' }).unresolved.map((u) => u.reason)).toEqual(['no-adapter']);
  });

  it('a hook that throws aborts the restore and leaves the history as it was', () => {
    const a = createHistory(null);
    a.applyOps([setX({ x: 0 }, 0, 5)], 'set');
    const b = createHistory(null, { rebuildOp: () => { throw new Error('hook'); } });
    expect(() => b.restore(a.serialize())).toThrow('hook');
    expect(b.canUndo()).toBe(false);
  });

  it('best-effort: substitutes a no-op placeholder when the hook returns null', () => {
    const cell: Cell = { x: 0 };
    const a = createHistory(null);
    a.applyOps([{
      name: 'rebuildtest:never-registered', args: {},
      apply: () => { cell.x = 1; },
      invert: () => ({ name: 'rebuildtest:never-registered', args: {}, apply: () => { cell.x = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set');
    const snap = a.serialize();

    const b = createHistory(null, { rebuildOp: () => null });
    b.restore(snap, { recovery: 'best-effort' });
    expect(b.entries().undo).toHaveLength(1); // slot preserved
    expect(() => b.undo()).not.toThrow();     // placeholder: undo does nothing
    expect(cell.x).toBe(1);                   // dst state untouched by placeholder
  });
});
