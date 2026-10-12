import { describe, expect, it } from 'vitest';
import type { ActivePaint } from './ActiveSwatches';
import { activeInsertPaint } from './insertPaint';

const RED: ActivePaint = { fill: 'solid', color: '#ff0000ff' };
const BLUE: ActivePaint = { fill: 'solid', color: '#0000ffff' };
const NONE: ActivePaint = null;

describe('activeInsertPaint', () => {
  it('gives a closed shape the active fill, and the active stroke 2 wide', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }));
    for (const kind of ['rect', 'ellipse', 'polygon', 'star', 'path']) {
      expect(paint(kind, 1), kind).toEqual({ fill: RED, stroke: { paint: BLUE, width: 2 } });
    }
  });

  it('gives a line or a pencil trail the active stroke and no fill', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }));
    expect(paint('line', 1)).toEqual({ fill: null, stroke: { paint: BLUE, width: 2 } });
    expect(paint('pencil', 1)).toEqual({ fill: null, stroke: { paint: BLUE, width: 2 } });
  });

  it('passes no paint through, on either side', () => {
    expect(activeInsertPaint(() => ({ fill: NONE, stroke: BLUE }))('rect', 1)).toEqual({
      fill: null,
      stroke: { paint: BLUE, width: 2 },
    });
    expect(activeInsertPaint(() => ({ fill: RED, stroke: NONE }))('rect', 1)).toEqual({ fill: RED, stroke: null });
  });

  it('reads the paints at each insert, not when it was made', () => {
    let fill = RED;
    const paint = activeInsertPaint(() => ({ fill, stroke: NONE }));
    fill = BLUE;
    expect(paint('rect', 2).fill).toBe(BLUE);
  });
});
