import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';
import { registerOpFactory } from 'core/ops/registry';

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
  it('hook wins over the global registry and receives (name, args)', () => {
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
    expect(seen).toEqual([
      ['rebuildtest:setX', { id: 'a', from: 0, to: 5 }],
      ['rebuildtest:setX', { id: 'a', from: 0, to: 5 }],
    ]); // forwardOps + baseOps of the single entry
    b.undo();
    expect(dst.x).toBe(0);
    b.redo();
    expect(dst.x).toBe(5);
  });

  it('hook returning null falls back to the global registry', () => {
    const cell: Cell = { x: 0 };
    // Unique name per test run — the global registry has no reset in the barrel.
    const NAME = 'rebuildtest:global-fallback';
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      const mk = (f: number, t: number): Op => ({
        name: NAME, args: { from: f, to: t },
        apply: () => { cell.x = t; },
        invert: () => mk(t, f),
      });
      return mk(from, to);
    });
    const a = createHistory(null);
    a.applyOps([{
      name: NAME, args: { from: 0, to: 3 },
      apply: () => { cell.x = 3; },
      invert: () => ({ name: NAME, args: { from: 3, to: 0 }, apply: () => { cell.x = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set');
    const snap = a.serialize();

    const b = createHistory(null, { rebuildOp: () => null });
    b.restore(snap);
    b.undo();
    expect(cell.x).toBe(0);
  });

  it('hook null + unknown global name still yields a no-op placeholder', () => {
    const cell: Cell = { x: 0 };
    const a = createHistory(null);
    a.applyOps([{
      name: 'rebuildtest:never-registered', args: {},
      apply: () => { cell.x = 1; },
      invert: () => ({ name: 'rebuildtest:never-registered', args: {}, apply: () => { cell.x = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set');
    const snap = a.serialize();

    const b = createHistory(null, { rebuildOp: () => null });
    b.restore(snap);
    expect(b.entries().undo).toHaveLength(1); // slot preserved
    expect(() => b.undo()).not.toThrow();     // placeholder: undo does nothing
    expect(cell.x).toBe(1);                   // dst state untouched by placeholder
  });
});
