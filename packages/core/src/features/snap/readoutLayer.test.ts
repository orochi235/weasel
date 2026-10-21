import { describe, expect, it, vi } from 'vitest';
import { createSnapOutcomeStore } from './outcomeStore';
import { createSnapReadoutLayer } from './readoutLayer';
import type { SnapMark } from './types';

// World (x, y) lands at (10 + 2x, 20 + 2y) on screen.
const VIEW = { x: -5, y: -10, scale: { x: 2, y: 2 } } as never;
const DIMS = { width: 400, height: 400 } as never;

function drawn(marks: readonly SnapMark[]) {
  const store = createSnapOutcomeStore();
  store.set(marks);
  return createSnapReadoutLayer(store).draw(undefined, VIEW, DIMS);
}

const coords = (c: unknown) => Array.from((c as { path: { coords: ArrayLike<number> } }).path.coords);

describe('createSnapReadoutLayer', () => {
  it('draws nothing from an empty store', () => {
    expect(drawn([])).toEqual([]);
  });

  it('draws a point as its glyph on the screen position, with its label', () => {
    const cmds = drawn([{ kind: 'point', at: { x: 20, y: 30 }, glyph: 'intersection', label: 'crossing' }]);
    expect(cmds.map((c) => c.kind)).toEqual(['path', 'text']);
    // The intersection glyph is an X over (50, 80), 5px each way.
    const c = coords(cmds[0]);
    expect(Math.min(...c.filter((_, i) => i % 2 === 0))).toBe(45);
    expect(Math.max(...c.filter((_, i) => i % 2 === 1))).toBe(85);
    // The label sits above and right of the glyph, clear of it.
    expect(cmds[1]).toMatchObject({ kind: 'text', x: 58, y: 62, runs: [expect.objectContaining({ text: 'crossing' })] });
  });

  it('draws a line as one bare segment between the screen ends', () => {
    const cmds = drawn([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 0, y: 50 } }]);
    expect(cmds).toHaveLength(1);
    expect(coords(cmds[0])).toEqual([10, 20, 10, 120]);
  });

  it.each(['gap', 'distance'] as const)('draws a %s as a ticked segment with its value on a pill', (kind) => {
    const cmds = drawn([{ kind, from: { x: 0, y: 0 }, to: { x: 20, y: 0 }, value: 20 }]);
    expect(cmds.map((c) => c.kind)).toEqual(['path', 'path', 'text']);
    // Segment (10, 20) to (50, 20), then a 6px tick across each end.
    expect(coords(cmds[0])).toEqual([10, 20, 50, 20, 10, 17, 10, 23, 50, 17, 50, 23]);
    expect(cmds[2]).toMatchObject({ runs: [expect.objectContaining({ text: '20' })] });
  });

  it('repaints when the store changes', () => {
    const store = createSnapOutcomeStore();
    const repaint = vi.fn();
    const off = createSnapReadoutLayer(store).subscribe!(repaint);
    store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }]);
    expect(repaint).toHaveBeenCalledTimes(1);
    off();
    store.set([]);
    expect(repaint).toHaveBeenCalledTimes(1);
  });

  it('draws a mark in its own color, else its kind\'s default', () => {
    const stroke = (c: unknown) => (c as { stroke: { paint: { color: string } } }).stroke.paint.color;
    const [own] = drawn([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, color: '#112233' }]);
    expect(stroke(own)).toBe('#112233');
    const [dflt] = drawn([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]);
    expect(stroke(dflt)).toBe('#e8742c');
    const [gap, pill] = drawn([{ kind: 'distance', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, value: 1, color: '#445566' }]);
    expect(stroke(gap)).toBe('#445566');
    expect((pill as { fill: { paint: { color: string } } }).fill.paint.color).toBe('#445566');
  });

  it('takes its defaults from the style', () => {
    const store = createSnapOutcomeStore();
    store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]);
    const [c] = createSnapReadoutLayer(store, { color: '#abcdef' }).draw(undefined, VIEW, DIMS);
    expect((c as unknown as { stroke: { paint: { color: string } } }).stroke.paint.color).toBe('#abcdef');
  });
});
