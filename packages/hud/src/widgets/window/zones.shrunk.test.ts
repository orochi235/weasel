/** Counterexamples `edges.pbt.test.ts` found in window zones, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { createWindow } from './window';
import { DEFAULT_WINDOW_METRICS, zoneAt } from './zones';

describe('window zones, shrunk', () => {
  it('names no zone for a point that is not finite, so a window lands none', () => {
    const b = { x: 0, y: 0, w: 200, h: 150 };
    expect(zoneAt(b, DEFAULT_WINDOW_METRICS, Number.NaN, Number.NaN)).toBeNull();
    expect(zoneAt(b, DEFAULT_WINDOW_METRICS, 10, Number.NaN)).toBeNull();
    expect(createWindow({ id: 'w', ...b, title: 'w' }).hitTest(Number.NaN, 30)).toBe(false);
  });
});
