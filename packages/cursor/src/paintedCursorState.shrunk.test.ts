import { describe, expect, it } from 'vitest';
import { createPaintedCursorState } from './paintedCursorState';

describe('createPaintedCursorState, shrunk', () => {
  it('notifies once for the same NaN angle written twice, where every write read as a change', () => {
    const state = createPaintedCursorState();
    let notes = 0;
    state.subscribe(() => { notes++; });
    state.setBase({ kind: 'painted', glyph: 'crosshair', angle: Number.NaN });
    state.setBase({ kind: 'painted', glyph: 'crosshair', angle: Number.NaN });
    expect(notes).toBe(1);
  });

  it('notifies once for a pointer at the same NaN twice', () => {
    const state = createPaintedCursorState();
    state.setBase({ kind: 'painted', glyph: 'crosshair', angle: 0 });
    let notes = 0;
    state.subscribe(() => { notes++; });
    state.setPointer(Number.NaN, 0);
    state.setPointer(Number.NaN, 0);
    expect(notes).toBe(1);
  });
});
