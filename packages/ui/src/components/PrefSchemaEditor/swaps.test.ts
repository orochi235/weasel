import { describe, expect, it } from 'vitest';
import { createHistory } from '@weasel-js/core';
import { swapOp } from './document';
import { mapSwaps } from './swaps';

interface Doc { n: number }

describe('mapSwaps', () => {
  const [a, b, c]: Doc[] = [{ n: 0 }, { n: 1 }, { n: 2 }];
  const history = createHistory(null);
  history.applyOps([swapOp(a, b, () => {})], 'edit');
  history.applyOps([swapOp(b, c, () => {})], 'edit');
  history.undo();
  const stacks = history.serialize();

  it('puts both values of every step through the function, back and forward', () => {
    const mapped = mapSwaps(stacks, (doc: Doc) => doc.n);
    expect(mapped.undoStack.map((e) => e.forwardOps[0]!.args)).toEqual([{ before: 0, after: 1 }]);
    expect(mapped.undoStack.map((e) => e.baseOps[0]!.args)).toEqual([{ before: 0, after: 1 }]);
    expect(mapped.redoStack.map((e) => e.forwardOps[0]!.args)).toEqual([{ before: 1, after: 2 }]);
    expect(mapped.redoStack.map((e) => e.baseOps[0]!.args)).toEqual([{ before: 1, after: 2 }]);
  });

  it('keeps everything else of the stacks and leaves the ones it was given alone', () => {
    const mapped = mapSwaps(stacks, (doc: Doc) => doc);
    expect(mapped).toEqual(stacks);
    expect(mapped).not.toBe(stacks);
    mapSwaps(stacks, (doc: Doc) => doc.n);
    expect(stacks.undoStack[0]!.forwardOps[0]!.args).toEqual({ before: a, after: b });
  });
});
