import { describe, expect, it } from 'vitest';
import { clearUndo, emptyStack, pushSnapshot, redo, undo } from './undoStack';

describe('UndoStack', () => {
  it('emptyStack has empty past and future', () => {
    expect(emptyStack()).toEqual({ past: [], future: [] });
  });

  it('pushSnapshot adds to past and clears future', () => {
    const s = { past: [1], future: [9] };
    const next = pushSnapshot(s, 2, 10);
    expect(next.past).toEqual([1, 2]);
    expect(next.future).toEqual([]);
  });

  it('pushSnapshot evicts past[0] at maxDepth (FIFO)', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'a', 3);
    s = pushSnapshot(s, 'b', 3);
    s = pushSnapshot(s, 'c', 3);
    s = pushSnapshot(s, 'd', 3);
    expect(s.past).toEqual(['b', 'c', 'd']);
  });

  it('undo restores last past snapshot and pushes current to future', () => {
    // Caller pushes pre-mutation snapshots: push 'pre-a' before applying 'a',
    // push 'pre-b' before applying 'b'. Current state at undo time is 'b'.
    let s = emptyStack();
    s = pushSnapshot(s, 'pre-a', 5);
    s = pushSnapshot(s, 'pre-b', 5);
    const r = undo(s, 'b');
    expect(r).not.toBeNull();
    expect(r?.snapshot).toBe('pre-b');
    expect(r?.stack.past).toEqual(['pre-a']);
    expect(r?.stack.future).toEqual(['b']);
  });

  it('undo on empty stack returns null', () => {
    expect(undo(emptyStack(), 'anything')).toBeNull();
  });

  it('redo restores last future snapshot and pushes current to past', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'pre-a', 5);
    const u = undo(s, 'a');
    if (!u) throw new Error('expected undo');
    // After undo we are at 'pre-a'; redo should advance back to 'a'.
    const r = redo(u.stack, u.snapshot);
    expect(r?.snapshot).toBe('a');
    expect(r?.stack.past).toEqual(['pre-a']);
    expect(r?.stack.future).toEqual([]);
  });

  it('redo on empty future returns null', () => {
    expect(redo(emptyStack(), 'anything')).toBeNull();
  });

  it('push after undo invalidates redo', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'pre-a', 5);
    const u = undo(s, 'a');
    if (!u) throw new Error();
    s = pushSnapshot(u.stack, 'pre-b', 5);
    expect(redo(s, 'b')).toBeNull();
  });

  it('clearUndo zeros both arrays', () => {
    expect(clearUndo({ past: [1, 2], future: [3] })).toEqual({ past: [], future: [] });
  });
});
