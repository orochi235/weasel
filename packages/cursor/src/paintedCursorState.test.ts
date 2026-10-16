import { describe, expect, it, vi } from 'vitest';
import { createPaintedCursorState, type PaintedCursor } from './paintedCursorState';

const ring: PaintedCursor = { kind: 'painted', glyph: 'crosshairRect', angle: 0, worldRadius: 10 };

describe('createPaintedCursorState', () => {
  it('paints the base, and an override over it', () => {
    const state = createPaintedCursorState();
    state.setBase(ring);
    state.setPointer(4, 5);
    expect(state.current()).toEqual({ cursor: ring, at: { x: 4, y: 5 } });
    const turned = { ...ring, angle: 1 };
    state.setOverride(turned);
    expect(state.current()?.cursor).toEqual(turned);
    state.setOverride(null);
    expect(state.current()?.cursor).toEqual(ring);
  });

  it("paints nothing under a 'none' override, the base included", () => {
    const state = createPaintedCursorState();
    state.setBase(ring);
    state.setPointer(4, 5);
    const changed = vi.fn();
    state.subscribe(changed);
    state.setOverride('none');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(state.current()).toBeNull();
    expect(state.active()).toBe(false);
    state.setPointer(6, 7);
    expect(changed).toHaveBeenCalledTimes(1);
    state.setOverride(null);
    expect(state.current()).toEqual({ cursor: ring, at: { x: 6, y: 7 } });
  });

  it('runs every subscriber past one that throws, and does not throw into the setter', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createPaintedCursorState();
    const after = vi.fn();
    state.subscribe(() => { throw new Error('boom'); });
    state.subscribe(after);
    expect(() => state.setBase(ring)).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
