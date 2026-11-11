/** Moves the sweep property test shrank to. */
import { afterEach, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '../actions/invoker';
import { sweepAction } from './sweep';

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

/** A row of 10px cells from x = 0, swept along `xs`; how many hit tests each move took, and the cells entered. */
function sweepRow(xs: number[]): { entered: string[]; hits: number[] } {
  const host = document.createElement('div');
  const cells = ['a', 'b', 'c'].map((k) => { const el = document.createElement('span'); el.dataset.key = k; host.append(el); return el; });
  document.body.append(host);
  let hit = 0;
  document.elementFromPoint = (x: number) => {
    if (++hit > 100_000) throw new Error('runaway');
    return cells[Math.floor(x / 10)] ?? document.body;
  };
  const entered: string[] = [];
  const invoker = sweepAction<string>({
    surface: () => host, keyOf: (el) => (el as HTMLElement).dataset.key,
    begin: () => ({ enter: (item) => { entered.push(item.key); } }),
  }).invoker as OngoingInvoker;
  const ctx = (x: number) => ({ world: { x, y: 0 }, modifiers: {}, deps: {}, drag: { start: { x: xs[0], y: 0 } } }) as unknown as InvocationCtx;
  const handle = invoker.start(ctx(xs[0]!));
  const hits: number[] = [];
  for (const x of xs.slice(1)) { hit = 0; handle.onMove?.(ctx(x)); hits.push(hit); }
  host.remove();
  return { entered, hits };
}

it('ignores a move to an infinite point, rather than hit-testing forever', () => {
  expect(sweepRow([0, -Infinity, 25]).entered).toEqual(['a', 'b', 'c']);
});

it('carries on from the last real point past a move to NaN', () => {
  expect(sweepRow([0, NaN, 25]).entered).toEqual(['a', 'b', 'c']);
});

it('hit-tests a jump a long way off at a bounded number of points, and lands where it went', () => {
  const { entered, hits } = sweepRow([0, 1e12, 15]);
  expect(Math.max(...hits)).toBeLessThanOrEqual(4096);
  expect(entered.at(-1)).toBe('b');
});
