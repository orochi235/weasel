/**
 * Property tests of a sweep across a grid of cells, driven through its action's handle: it enters the same cells
 * wherever on the page the grid and the drag sit, it always stands on the cell under the pointer after a move,
 * and a move to a point that is no number, or one a long way off, neither stalls it nor ends what it can reach.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { InvocationCtx, OngoingInvoker } from '../actions/invoker';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { sweepAction } from './sweep';

interface Grid { ox: number; oy: number; cols: number; rows: number; w: number; h: number }

/** The most hit tests one move may take: far more than any grid here needs, far fewer than a runaway loop. */
const HIT_TEST_BUDGET = 20_000;

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

const cellAt = (g: Grid, x: number, y: number): string | undefined => {
  const c = Math.floor((x - g.ox) / g.w);
  const r = Math.floor((y - g.oy) / g.h);
  return c >= 0 && c < g.cols && r >= 0 && r < g.rows ? `${c},${r}` : undefined;
};

/** Sweep `path` across `g`: the keys entered, and after each move the key last entered. */
function sweep(g: Grid, path: readonly { x: number; y: number }[]): { entered: string[]; after: (string | undefined)[] } {
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  const cells = new Map<string, HTMLElement>();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const el = document.createElement('span');
    el.dataset.key = `${c},${r}`;
    host.append(el);
    cells.set(`${c},${r}`, el);
  }
  let hits = 0;
  document.elementFromPoint = (x: number, y: number) => {
    if (++hits > HIT_TEST_BUDGET) throw new Error(`more than ${HIT_TEST_BUDGET} hit tests in one move`);
    const key = cellAt(g, x, y);
    return key ? cells.get(key)! : document.body;
  };
  const entered: string[] = [];
  const action = sweepAction<string>({
    surface: () => host,
    keyOf: (el) => (el as HTMLElement).dataset.key,
    begin: () => ({ enter: (item) => { entered.push(item.key); } }),
  });
  const invoker = action.invoker as OngoingInvoker;
  const [first, ...rest] = path;
  const ctx = (p: { x: number; y: number }) => ({ world: p, modifiers: {}, deps: {}, drag: { start: first } }) as unknown as InvocationCtx;
  const handle = invoker.start(ctx(first!));
  const after: (string | undefined)[] = [];
  for (const p of rest) {
    hits = 0;
    handle.onMove?.(ctx(p));
    after.push(entered.at(-1));
  }
  handle.onEnd?.(ctx(path.at(-1)!), 'commit');
  return { entered, after };
}

const grid = fc.record({
  ox: fc.integer({ min: -50, max: 50 }), oy: fc.integer({ min: -50, max: 50 }),
  cols: fc.integer({ min: 1, max: 6 }), rows: fc.integer({ min: 1, max: 4 }),
  w: fc.integer({ min: 4, max: 40 }), h: fc.integer({ min: 4, max: 40 }),
});
const pointIn = (g: Grid) => fc.record({
  x: fc.integer({ min: g.ox - 20, max: g.ox + g.cols * g.w + 20 }),
  y: fc.integer({ min: g.oy - 20, max: g.oy + g.rows * g.h + 20 }),
});
const pressed = (g: Grid) => fc.record({
  x: fc.integer({ min: g.ox, max: g.ox + g.cols * g.w - 1 }), y: fc.integer({ min: g.oy, max: g.oy + g.rows * g.h - 1 }),
});
const drag = grid.chain((g) => fc.tuple(fc.constant(g), pressed(g), fc.array(pointIn(g), { minLength: 1, maxLength: 12 })));

/** Each move that ends on a cell leaves the sweep standing on it, and no cell is entered twice running. */
function expectFollows(g: Grid, path: readonly { x: number; y: number }[], { entered, after }: ReturnType<typeof sweep>): void {
  expect(entered[0]).toBe(cellAt(g, path[0]!.x, path[0]!.y));
  for (let i = 1; i < entered.length; i++) expect(entered[i]).not.toBe(entered[i - 1]);
  path.slice(1).forEach((p, i) => {
    const under = Number.isFinite(p.x) && Number.isFinite(p.y) ? cellAt(g, p.x, p.y) : undefined;
    if (under !== undefined) expect(after[i], `after a move to ${p.x},${p.y}`).toBe(under);
  });
}

describe('sweepAction', () => {
  it('stands on the cell under the pointer after every move, entering none twice running', () => {
    fc.assert(fc.property(drag, ([g, first, rest]) => {
      const path = [first, ...rest];
      expectFollows(g, path, sweep(g, path));
    }), runs(300));
  });

  it('enters the same cells wherever on the page the grid and the drag sit', () => {
    fc.assert(fc.property(drag, fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: -1e9, max: 1e9 }), ([g, first, rest], dx, dy) => {
      const path = [first, ...rest];
      const moved = { ...g, ox: g.ox + dx, oy: g.oy + dy };
      expect(sweep(moved, path.map((p) => ({ x: p.x + dx, y: p.y + dy }))).entered).toEqual(sweep(g, path).entered);
    }), runs(300));
  });

  it('carries on past a move to a point that is no number, or one a long way off', () => {
    const t = tally();
    const odd = fc.record({
      x: fc.constantFrom(NaN, Infinity, -Infinity, 1e12, -1e300, 0),
      y: fc.constantFrom(NaN, Infinity, 1e15, 0),
    });
    fc.assert(fc.property(drag, fc.array(fc.tuple(fc.nat(12), odd), { minLength: 1, maxLength: 3 }), ([g, first, rest], spliced) => {
      const moves = [...rest];
      for (const [at, p] of spliced) moves.splice(Math.min(at, moves.length), 0, p);
      if (moves.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) t.hit('no number');
      if (moves.some((p) => Math.abs(p.x) >= 1e12 || Math.abs(p.y) >= 1e12)) t.hit('far off');
      const path = [first, ...moves];
      expectFollows(g, path, sweep(g, path));
    }), runs(300));
    t.expectHit('no number', 'far off');
  }, timeoutFor(300, 6));
});
