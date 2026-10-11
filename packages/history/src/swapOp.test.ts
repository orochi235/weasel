import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { type SwapArgs, swapOp } from './swapOp';

function harness() {
  let value = 'a';
  const emit = (next: string) => {
    value = next;
  };
  const swap = (before: string, after: string, coalesceKey?: string) =>
    swapOp({ name: 'test.swap', label: 'edit', before, after, emit, coalesceKey });
  let now = 0;
  const history = createHistory(null, {
    coalesceWindowMs: 100,
    now: () => now,
    rebuildOp: (name, args) => (name === 'test.swap' ? swap((args as SwapArgs<string>).before, (args as SwapArgs<string>).after) : null),
  });
  return { history, swap, read: () => value, wait: (ms: number) => (now += ms) };
}

describe('swapOp', () => {
  it('puts the new value in force, and the old one back on undo', () => {
    const { history, swap, read } = harness();
    history.applyOps([swap('a', 'b')], 'edit');
    expect(read()).toBe('b');
    history.undo();
    expect(read()).toBe('a');
    history.redo();
    expect(read()).toBe('b');
  });

  it('undoes a run of swaps sharing a key back to where the run began', () => {
    const { history, swap, read } = harness();
    history.applyOps([swap('a', 'b', 'k')], 'edit');
    history.applyOps([swap('b', 'c', 'k')], 'edit');
    expect(history.undoDepth()).toBe(1);
    history.undo();
    expect(read()).toBe('a');
    history.redo();
    expect(read()).toBe('c');
  });

  it('is rebuilt from a serialized history by its name and args', () => {
    const first = harness();
    first.history.applyOps([first.swap('a', 'b')], 'edit');
    first.wait(1000);
    first.history.applyOps([first.swap('b', 'c')], 'edit');
    const second = harness();
    second.history.restore(JSON.parse(JSON.stringify(first.history.serialize())));
    second.history.undo();
    expect(second.read()).toBe('b');
    second.history.undo();
    expect(second.read()).toBe('a');
  });
});
