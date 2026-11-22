import { describe, expect, it } from 'vitest';
import { createWindow } from './window';
import { roundContentRect, roundZoneAt, squareDrag } from './roundZones';
import { DEFAULT_WINDOW_METRICS as M } from './zones';

const B = { x: 0, y: 0, width: 200, height: 200 };

describe('roundZoneAt', () => {
  it('answers nothing in the corners of its bounds', () => {
    expect(roundZoneAt(B, M, false, 5, 5)).toBeNull();
  });

  it('names a rim press for the compass point it pulls', () => {
    expect(roundZoneAt(B, M, false, 198, 100)).toBe('e');
    expect(roundZoneAt(B, M, false, 100, 2)).toBe('n');
    expect(roundZoneAt(B, M, false, 30, 30)).toBe('nw');
  });

  it('rings a passing interior with a grip that moves it', () => {
    expect(roundZoneAt(B, M, true, 100, 100 - 100 + M.edge + 2)).toBe('title');
    expect(roundZoneAt(B, M, false, 100, 100 - 100 + M.edge + 2)).toBe('content');
  });
});

it('insets the interior by the rim', () => {
  expect(roundContentRect(B, M, false)).toEqual({ x: 6, y: 6, width: 188, height: 188 });
});

describe('squareDrag', () => {
  it('grows a side pull about the center of the other axis', () => {
    expect(squareDrag(B, { ...B, width: 240 }, 'e')).toEqual({ x: 0, y: -20, width: 240, height: 240 });
  });

  it('holds the opposite corner on a corner pull', () => {
    expect(squareDrag(B, { x: -40, y: -10, width: 240, height: 210 }, 'nw'))
      .toEqual({ x: -40, y: -40, width: 240, height: 240 });
  });
});

describe('a round window', () => {
  const make = (interior?: 'claim' | 'pass') =>
    createWindow({ id: 'w', title: 'Loupe', shape: 'round', x: 0, y: 0, width: 240, height: 200, ...(interior ? { interior } : {}) });

  it('keeps its bounds square', () => {
    const w = make();
    expect(w.bounds).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    w.setBounds({ x: 0, y: 0, width: 300, height: 260 });
    expect(w.bounds.width).toBe(w.bounds.height);
  });

  it('is hit only inside its circle', () => {
    const w = make();
    expect(w.hitTest(5, 5)).toBe(false);
    expect(w.hitTest(100, 100)).toBe(true);
    expect(w.shape).toBe('round');
  });

  it('stays square through a rim drag', () => {
    const w = make();
    w.onPointer({ type: 'down', x: 198, y: 100, native: null });
    w.onPointer({ type: 'move', x: 238, y: 100, native: null });
    expect(w.bounds).toEqual({ x: 0, y: -20, width: 240, height: 240 });
  });
});
