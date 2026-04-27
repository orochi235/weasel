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

  it('undo returns last pushed snapshot and moves it to future', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'a', 5);
    s = pushSnapshot(s, 'b', 5);
    const r = undo(s);
    expect(r).not.toBeNull();
    expect(r?.snapshot).toBe('b');
    expect(r?.stack.past).toEqual(['a']);
    expect(r?.stack.future).toEqual(['b']);
  });

  it('undo on empty stack returns null', () => {
    expect(undo(emptyStack())).toBeNull();
  });

  it('redo returns most recently undone snapshot', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'a', 5);
    const u = undo(s);
    if (!u) throw new Error('expected undo');
    const r = redo(u.stack);
    expect(r?.snapshot).toBe('a');
    expect(r?.stack.past).toEqual(['a']);
    expect(r?.stack.future).toEqual([]);
  });

  it('redo on empty future returns null', () => {
    expect(redo(emptyStack())).toBeNull();
  });

  it('push after undo invalidates redo', () => {
    let s = emptyStack();
    s = pushSnapshot(s, 'a', 5);
    const u = undo(s);
    if (!u) throw new Error();
    s = pushSnapshot(u.stack, 'b', 5);
    expect(redo(s)).toBeNull();
  });

  it('clearUndo zeros both arrays', () => {
    expect(clearUndo({ past: [1, 2], future: [3] })).toEqual({ past: [], future: [] });
  });
});
